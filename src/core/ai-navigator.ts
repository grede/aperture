import OpenAI from 'openai';
import type {
  NavigationResult,
  ActionRecord,
  Guardrails,
  LLMAction,
  LLMVerification,
  AccessibilityNode,
} from '../types/index.js';
import type { IMobileAutomationProvider } from './providers/index.js';
import type { CostTracker } from './cost-tracker.js';

// ── AINavigator Class ──────────────────────────────────────────

export class AINavigator {
  private openai: OpenAI;
  private defaultModel: string;
  private escalationModel: string;
  private escalateAfterAttempts: number;

  constructor(
    apiKey: string,
    defaultModel = 'gpt-4o-mini',
    escalationModel = 'gpt-4o',
    escalateAfterAttempts = 5
  ) {
    this.openai = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
    this.escalationModel = escalationModel;
    this.escalateAfterAttempts = escalateAfterAttempts;
  }

  /**
   * Navigate to a target screen based on natural language instruction
   * Uses observe → plan → act → verify loop
   */
  async navigate(
    instruction: string,
    provider: IMobileAutomationProvider,
    costTracker: CostTracker,
    guardrails: Guardrails
  ): Promise<NavigationResult> {
    const actionHistory: ActionRecord[] = [];
    const startTime = Date.now();
    let actionsExecuted = 0;
    let currentModel = this.defaultModel;
    let previousTreeHash: string | null = null;
    let noProgressCount = 0;
    let visionContext = ''; // Persistent vision context for when stuck

    try {
      // Main navigation loop
      while (actionsExecuted < guardrails.maxActionsPerStep) {
        // Check timeout
        if (Date.now() - startTime > guardrails.stepTimeoutMs) {
          throw new Error(`Step timeout exceeded (${guardrails.stepTimeoutMs}ms)`);
        }

        // Check cost cap
        if (costTracker.isOverBudget(guardrails.costCapUsd)) {
          throw new Error(`Cost cap exceeded ($${guardrails.costCapUsd})`);
        }

        // 1. OBSERVE: Get current screen state
        const accessibilityTree = await provider.getAccessibilityTree();

        // 2. PLAN: Ask LLM what action to take
        const action = await this.planAction(
          instruction,
          accessibilityTree,
          actionHistory,
          currentModel,
          costTracker,
          visionContext
        );

        // Check for forbidden actions
        if (this.isForbiddenAction(action, guardrails.forbiddenActions)) {
          throw new Error(
            `Forbidden action detected: ${action.type} (contains forbidden keyword)`
          );
        }

        // 3. ACT: Execute the action
        let actionSuccess = false;
        try {
          await this.executeAction(action, provider);
          actionSuccess = true;
        } catch (error) {
          // Record the failed action and re-throw
          actionHistory.push({
            timestamp: Date.now(),
            action: action.type,
            params: action.params,
            reasoning: action.reasoning,
            success: false,
          });
          actionsExecuted++;
          throw error; // Propagate the detailed error
        }

        // Record successful action
        actionHistory.push({
          timestamp: Date.now(),
          action: action.type,
          params: action.params,
          reasoning: action.reasoning,
          success: actionSuccess,
        });

        actionsExecuted++;

        // Wait a moment for UI to update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 4. VERIFY: Check if goal was reached
        const newAccessibilityTree = await provider.getAccessibilityTree();

        // Check if screen changed (detect stuck states)
        const newTreeHash = this.hashAccessibilityTree(newAccessibilityTree);
        if (previousTreeHash === newTreeHash) {
          noProgressCount++;

          // Trigger vision fallback before final attempt
          const visionTriggerThreshold = guardrails.noProgressThreshold - 1;
          if (noProgressCount === visionTriggerThreshold && !visionContext) {
            console.log(`[Vision Fallback] No progress after ${visionTriggerThreshold} attempts, analyzing screenshot...`);
            try {
              const screenshot = await provider.takeScreenshot();
              const screenshotBase64 = screenshot.toString('base64');

              // Get screen dimensions from accessibility tree for coordinate mapping
              const screenBounds = this.getScreenBounds(newAccessibilityTree);

              visionContext = await this.analyzeScreenshot(
                screenshotBase64,
                instruction,
                currentModel,
                costTracker,
                screenBounds
              );
              console.log('[Vision Fallback] Screenshot analysis completed, will use in next planning');
            } catch (error) {
              console.warn('[Vision Fallback] Screenshot analysis failed:', error);
            }
          }

          if (noProgressCount >= guardrails.noProgressThreshold) {
            throw new Error(
              `No screen changes detected after ${guardrails.noProgressThreshold} consecutive actions. The UI may not be responding to clicks, or the target element is not accessible. Last action: ${action.type} with params ${JSON.stringify(action.params)}`
            );
          }
        } else {
          noProgressCount = 0; // Reset counter when progress is made
          visionContext = ''; // Clear vision context when we make progress
        }
        previousTreeHash = newTreeHash;

        const verification = await this.verifyGoal(
          instruction,
          newAccessibilityTree,
          actionHistory,
          currentModel,
          costTracker
        );

        if (verification.goalReached) {
          // Success!
          return {
            success: true,
            actionsExecuted,
            totalTokens: costTracker.getTotalTokens().prompt + costTracker.getTotalTokens().completion,
            estimatedCost: costTracker.getTotalCost(),
            actionHistory,
          };
        }

        // Escalate to better model if struggling
        if (actionsExecuted >= this.escalateAfterAttempts && currentModel === this.defaultModel) {
          currentModel = this.escalationModel;
          console.log(`Escalating to ${this.escalationModel} after ${actionsExecuted} attempts`);
        }
      }

      // Max actions reached without success
      throw new Error(`Max actions (${guardrails.maxActionsPerStep}) reached without achieving goal`);
    } catch (error) {
      return {
        success: false,
        actionsExecuted,
        totalTokens: costTracker.getTotalTokens().prompt + costTracker.getTotalTokens().completion,
        estimatedCost: costTracker.getTotalCost(),
        actionHistory,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Plan the next action based on current screen state
   */
  private async planAction(
    instruction: string,
    accessibilityTree: AccessibilityNode,
    actionHistory: ActionRecord[],
    model: string,
    costTracker: CostTracker,
    visionContext?: string
  ): Promise<LLMAction> {
    const systemPrompt = this.buildPlanningSystemPrompt();
    const userPrompt = this.buildPlanningUserPrompt(instruction, accessibilityTree, actionHistory, visionContext);

    // GPT-5 models don't support temperature parameter with non-default values
    const supportsTemperature = !model.startsWith('gpt-5');

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...(supportsTemperature && { temperature: 0.1 }),
      response_format: { type: 'json_object' },
    });

    // Track cost
    costTracker.record(
      model,
      response.usage?.prompt_tokens ?? 0,
      response.usage?.completion_tokens ?? 0
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const action = JSON.parse(content) as LLMAction;
    return action;
  }

  /**
   * Verify if the navigation goal was reached
   */
  private async verifyGoal(
    instruction: string,
    accessibilityTree: AccessibilityNode,
    actionHistory: ActionRecord[],
    model: string,
    costTracker: CostTracker
  ): Promise<LLMVerification> {
    const systemPrompt = this.buildVerificationSystemPrompt();
    const userPrompt = this.buildVerificationUserPrompt(
      instruction,
      accessibilityTree,
      actionHistory
    );

    // GPT-5 models don't support temperature parameter with non-default values
    const supportsTemperature = !model.startsWith('gpt-5');

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...(supportsTemperature && { temperature: 0.1 }),
      response_format: { type: 'json_object' },
    });

    // Track cost
    costTracker.record(
      model,
      response.usage?.prompt_tokens ?? 0,
      response.usage?.completion_tokens ?? 0
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const verification = JSON.parse(content) as LLMVerification;
    return verification;
  }

  /**
   * Execute an action via mobile automation provider
   * Throws on error to propagate detailed error messages
   */
  private async executeAction(action: LLMAction, provider: IMobileAutomationProvider): Promise<void> {
    switch (action.type) {
      case 'tap':
        if ('element_id' in action.params && typeof action.params.element_id === 'string') {
          await provider.tap(action.params.element_id);
        } else if (
          'x' in action.params &&
          'y' in action.params &&
          typeof action.params.x === 'number' &&
          typeof action.params.y === 'number'
        ) {
          await provider.tapCoordinates(action.params.x, action.params.y);
        } else {
          throw new Error(`Invalid tap action parameters: ${JSON.stringify(action.params)}`);
        }
        break;

      case 'type':
        if ('text' in action.params && typeof action.params.text === 'string') {
          await provider.type(action.params.text);
        } else {
          throw new Error(`Invalid type action parameters: ${JSON.stringify(action.params)}`);
        }
        break;

      case 'scroll':
        if ('direction' in action.params) {
          await provider.scroll(
            action.params.direction as 'up' | 'down' | 'left' | 'right',
            action.params.amount as number | undefined
          );
        } else {
          throw new Error(`Invalid scroll action parameters: ${JSON.stringify(action.params)}`);
        }
        break;

      case 'swipe':
        if (
          'startX' in action.params &&
          'startY' in action.params &&
          'endX' in action.params &&
          'endY' in action.params
        ) {
          await provider.swipe(
            action.params.startX as number,
            action.params.startY as number,
            action.params.endX as number,
            action.params.endY as number
          );
        } else {
          throw new Error(`Invalid swipe action parameters: ${JSON.stringify(action.params)}`);
        }
        break;

      case 'press_button':
        if ('button' in action.params) {
          await provider.pressButton(action.params.button as 'home' | 'back');
        } else {
          throw new Error(`Invalid press_button action parameters: ${JSON.stringify(action.params)}`);
        }
        break;

      case 'wait':
        const duration = (action.params.duration as number) ?? 1000;
        await new Promise((resolve) => setTimeout(resolve, duration));
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Check if action contains forbidden keywords
   */
  private isForbiddenAction(action: LLMAction, forbiddenActions: string[]): boolean {
    const actionStr = JSON.stringify(action).toLowerCase();
    return forbiddenActions.some((forbidden) => actionStr.includes(forbidden.toLowerCase()));
  }

  /**
   * Build system prompt for action planning
   */
  private buildPlanningSystemPrompt(): string {
    return `You are an AI agent controlling an iOS app in the Simulator. Your job is to navigate the app to reach a specific screen or state.

Available actions:
- tap: Tap at coordinates (extract x,y from element's frame) { "type": "tap", "params": { "x": 100, "y": 200 } }
- type: Type text into focused field { "type": "type", "params": { "text": "..." } }
- scroll: Scroll in a direction { "type": "scroll", "params": { "direction": "up|down|left|right", "amount": 100 } }
- swipe: Swipe gesture { "type": "swipe", "params": { "startX": 100, "startY": 100, "endX": 200, "endY": 200 } }
- wait: Wait for duration in ms { "type": "wait", "params": { "duration": 1000 } }

You will receive:
1. The navigation instruction (what screen/state to reach)
2. The current accessibility tree (UI elements with their positions and attributes)
3. History of actions already taken
4. OPTIONAL: "Additional Visual Analysis" from screenshot (when previous attempts failed)

COORDINATES:
- Accessibility tree: Elements have "frame" with x, y, width, height. Calculate center: x = frame.x + (frame.width / 2), y = frame.y + (frame.height / 2)
- Visual analysis: Provides EXACT pixel coordinates (X, Y) - use these DIRECTLY without calculation

CRITICAL RULES:
1. When "Additional Visual Analysis" is provided, STRONGLY PREFER those coordinates
   - Visual analysis sees ALL elements including unlabeled icons/buttons
   - Accessibility tree often MISSES icon-only buttons and FABs
   - If looking for "+", "create", unlabeled icons → USE VISION COORDINATES
2. If previous attempts failed and vision is now available → MUST try vision coordinates
3. Don't repeat the same failed action - if you tapped wrong coords, use vision
4. If stuck after 2 attempts, you'll get vision - pay attention to it!
5. SCROLLABLE CONTENT: Many screens have scrollable content below the fold
   - If you can't find a button/element you're looking for (e.g., "Save", "Create", "Submit")
   - Try scrolling DOWN to see if it's below the visible area
   - Forms often have submit buttons at the bottom that require scrolling
   - Don't give up until you've checked by scrolling down!

Respond with JSON:
{
  "type": "action_type",
  "params": { /* action params */ },
  "reasoning": "Why you chose this action (mention if using vision coordinates)"
}`;
  }

  /**
   * Build user prompt for action planning
   */
  private buildPlanningUserPrompt(
    instruction: string,
    accessibilityTree: AccessibilityNode,
    actionHistory: ActionRecord[],
    visionContext?: string
  ): string {
    const treeStr = this.serializeAccessibilityTree(accessibilityTree);
    const historyStr = actionHistory
      .map((a, i) => `${i + 1}. ${a.action} - ${a.reasoning} (${a.success ? '✓' : '✗'})`)
      .join('\n');

    return `Goal: ${instruction}

Current Screen (Accessibility Tree):
${treeStr}

${visionContext ? `Additional Visual Analysis:\n${visionContext}\n\n` : ''}${actionHistory.length > 0 ? `Previous Actions:\n${historyStr}\n` : ''}
What action should I take next to reach the goal? Respond with JSON only.`;
  }

  /**
   * Build system prompt for goal verification
   */
  private buildVerificationSystemPrompt(): string {
    return `You are verifying if an AI agent has successfully reached its navigation goal in an iOS app.

Respond with JSON:
{
  "goalReached": true/false,
  "reasoning": "Why you think the goal is/isn't reached"
}

Be accurate:
- The goal should be fully achieved, not partially
- Consider the current screen state
- Don't assume success without clear evidence`;
  }

  /**
   * Build user prompt for goal verification
   */
  private buildVerificationUserPrompt(
    instruction: string,
    accessibilityTree: AccessibilityNode,
    actionHistory: ActionRecord[]
  ): string {
    const treeStr = this.serializeAccessibilityTree(accessibilityTree);
    const historyStr = actionHistory
      .map((a, i) => `${i + 1}. ${a.action} - ${a.reasoning}`)
      .join('\n');

    return `Goal: ${instruction}

Current Screen:
${treeStr}

Actions Taken:
${historyStr}

Has the goal been reached? Respond with JSON only.`;
  }

  /**
   * Serialize accessibility tree to readable text
   */
  private serializeAccessibilityTree(node: AccessibilityNode, indent = 0): string {
    const prefix = '  '.repeat(indent);
    let result = `${prefix}${node.role}`;

    if (node.label) result += ` "${node.label}"`;
    if (node.value) result += ` value="${node.value}"`;
    if (node.id) result += ` [id=${node.id}]`;

    result += '\n';

    for (const child of node.children ?? []) {
      result += this.serializeAccessibilityTree(child, indent + 1);
    }

    return result;
  }

  /**
   * Check if accessibility tree is sparse (missing many elements)
   * Sparse trees indicate the accessibility API isn't capturing all UI elements
   */
  private isAccessibilityTreeSparse(node: AccessibilityNode): boolean {
    const countElements = (n: AccessibilityNode): {
      total: number;
      labeled: number;
      suspicious: number;
    } => {
      let total = 1;
      let labeled = (n.label || n.value) ? 1 : 0;
      // Suspicious: empty labels but has specific frame (likely unlabeled buttons/icons)
      let suspicious = (!n.label && !n.value && n.frame.width > 0 && n.frame.width < 100) ? 1 : 0;

      for (const child of n.children ?? []) {
        const childCounts = countElements(child);
        total += childCounts.total;
        labeled += childCounts.labeled;
        suspicious += childCounts.suspicious;
      }

      return { total, labeled, suspicious };
    };

    const counts = countElements(node);
    const labeledRatio = counts.labeled / counts.total;

    console.log(`[Vision Check] Elements: ${counts.total}, Labeled: ${counts.labeled} (${(labeledRatio * 100).toFixed(1)}%), Suspicious: ${counts.suspicious}`);

    // Tree is sparse if:
    // 1. Very few elements (< 8)
    // 2. Less than 50% of elements have labels
    // 3. Has suspicious unlabeled small elements (likely buttons/icons)
    const isSparse = counts.total < 8 || labeledRatio < 0.5 || counts.suspicious > 0;

    if (isSparse) {
      console.log(`[Vision Check] Triggering vision fallback (total: ${counts.total}, labeled ratio: ${(labeledRatio * 100).toFixed(1)}%, suspicious: ${counts.suspicious})`);
    }

    return isSparse;
  }

  /**
   * Analyze screenshot with vision model to find interactive elements
   * Returns a text description of clickable elements and their approximate locations
   */
  private async analyzeScreenshot(
    screenshotBase64: string,
    instruction: string,
    model: string,
    costTracker: CostTracker,
    screenBounds: { width: number; height: number }
  ): Promise<string> {
    // Use vision-capable model (GPT-4o or GPT-5.1)
    const visionModel = model.startsWith('gpt-5') ? 'gpt-5.1' : 'gpt-4o';

    console.log(`[Vision] Analyzing screenshot with ${visionModel} (screen: ${screenBounds.width}×${screenBounds.height})`);

    const response = await this.openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are analyzing an iOS app screenshot to help an AI navigate.

TASK: ${instruction}

CRITICAL COORDINATE INFORMATION:
The screenshot you're seeing has been resized for analysis, but you MUST provide coordinates in the ORIGINAL screen coordinate system:
- Original screen size: ${screenBounds.width}×${screenBounds.height} logical points
- Coordinates MUST be in this ${screenBounds.width}×${screenBounds.height} coordinate system
- Top-left is (0, 0), bottom-right is approximately (${screenBounds.width}, ${screenBounds.height})

Your job:
1. Identify ALL interactive elements visible on screen (buttons, icons, tabs, fields, FABs)
2. For EACH element, provide coordinates in the ${screenBounds.width}×${screenBounds.height} coordinate system

IMPORTANT ELEMENTS TO FIND:
- Floating Action Buttons (FABs) - typically circular, in corners, often unlabeled
- "+" buttons - high priority for this task
- Unlabeled icon buttons (many iOS buttons are icon-only)
- Navigation elements, tabs, and other interactive UI

Format each element like this:
"Settings" icon (top-right) → (${Math.round(screenBounds.width * 0.9)}, 80) → button
Unlabeled "+" FAB (bottom-right corner) → (${Math.round(screenBounds.width * 0.85)}, ${Math.round(screenBounds.height * 0.95)}) → floating action button

Coordinates must match the ${screenBounds.width}×${screenBounds.height} screen, NOT the resized image you see.
List every tappable element, especially unlabeled buttons and FABs.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
              },
            },
          ],
        },
      ],
    });

    // Track cost
    costTracker.record(
      visionModel,
      response.usage?.prompt_tokens ?? 0,
      response.usage?.completion_tokens ?? 0
    );

    const analysis = response.choices[0]?.message?.content || '';
    console.log(`[Vision] Analysis result:\n${analysis.substring(0, 300)}...`);

    return analysis;
  }

  /**
   * Get actual screen dimensions for iPhone/iPad
   * Returns standard logical point dimensions for iOS devices
   * We can't rely on accessibility tree bounds because some elements (like FABs)
   * may not be in the tree at all
   */
  private getScreenBounds(node: AccessibilityNode): { width: number; height: number } {
    // Standard iPhone logical point sizes (Portrait)
    // iPhone 14/15/16/17 Pro Max: 430×932
    // iPhone 14/15/16/17 Plus: 428×926
    // iPhone 14/15/16/17 Pro: 393×852
    // iPhone 14/15/16/17: 390×844
    // iPhone SE: 375×667

    // Try to infer from element positions, but don't trust it completely
    let maxX = 0;
    let maxY = 0;

    const traverse = (n: AccessibilityNode) => {
      const right = n.frame.x + n.frame.width;
      const bottom = n.frame.y + n.frame.height;

      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;

      for (const child of n.children ?? []) {
        traverse(child);
      }
    };

    traverse(node);

    // Determine which iPhone size based on width
    // Most elements should span close to screen width
    if (maxX >= 420) {
      // Pro Max size
      return { width: 430, height: 932 };
    } else if (maxX >= 385) {
      // Pro/regular size
      return { width: 393, height: 852 };
    } else if (maxX >= 360) {
      // SE/mini size
      return { width: 375, height: 667 };
    }

    // Default to Pro Max (most common large iPhone)
    return { width: 430, height: 932 };
  }

  /**
   * Create a simple hash of the accessibility tree to detect screen changes
   */
  private hashAccessibilityTree(node: AccessibilityNode): string {
    const serialize = (n: AccessibilityNode): string => {
      const parts = [
        n.role,
        n.label || '',
        n.value || '',
        `${n.frame.x},${n.frame.y},${n.frame.width},${n.frame.height}`,
      ];

      const childHashes = (n.children ?? []).map(serialize).join('|');
      return parts.join(':') + (childHashes ? `[${childHashes}]` : '');
    };

    return serialize(node);
  }
}
