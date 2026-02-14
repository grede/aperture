import OpenAI from 'openai';
import type {
  NavigationResult,
  ActionRecord,
  Guardrails,
  LLMAction,
  LLMVerification,
  AccessibilityNode,
} from '../types/index.js';
import type { MCPClient } from './mcp-client.js';
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
    mcpClient: MCPClient,
    costTracker: CostTracker,
    guardrails: Guardrails
  ): Promise<NavigationResult> {
    const actionHistory: ActionRecord[] = [];
    const startTime = Date.now();
    let actionsExecuted = 0;
    let currentModel = this.defaultModel;

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
        const accessibilityTree = await mcpClient.getAccessibilityTree();

        // 2. PLAN: Ask LLM what action to take
        const action = await this.planAction(
          instruction,
          accessibilityTree,
          actionHistory,
          currentModel,
          costTracker
        );

        // Check for forbidden actions
        if (this.isForbiddenAction(action, guardrails.forbiddenActions)) {
          throw new Error(
            `Forbidden action detected: ${action.type} (contains forbidden keyword)`
          );
        }

        // 3. ACT: Execute the action
        const actionSuccess = await this.executeAction(action, mcpClient);

        // Record action
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
        const newAccessibilityTree = await mcpClient.getAccessibilityTree();
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
    costTracker: CostTracker
  ): Promise<LLMAction> {
    const systemPrompt = this.buildPlanningSystemPrompt();
    const userPrompt = this.buildPlanningUserPrompt(instruction, accessibilityTree, actionHistory);

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
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

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
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
   * Execute an action via MCP client
   */
  private async executeAction(action: LLMAction, mcpClient: MCPClient): Promise<boolean> {
    try {
      switch (action.type) {
        case 'tap':
          if ('element_id' in action.params && typeof action.params.element_id === 'string') {
            await mcpClient.tap(action.params.element_id);
          } else if (
            'x' in action.params &&
            'y' in action.params &&
            typeof action.params.x === 'number' &&
            typeof action.params.y === 'number'
          ) {
            await mcpClient.tapCoordinates(action.params.x, action.params.y);
          }
          break;

        case 'type':
          if ('text' in action.params && typeof action.params.text === 'string') {
            await mcpClient.type(action.params.text);
          }
          break;

        case 'scroll':
          if ('direction' in action.params) {
            await mcpClient.scroll(
              action.params.direction as 'up' | 'down' | 'left' | 'right',
              action.params.amount as number | undefined
            );
          }
          break;

        case 'swipe':
          if (
            'startX' in action.params &&
            'startY' in action.params &&
            'endX' in action.params &&
            'endY' in action.params
          ) {
            await mcpClient.swipe(
              action.params.startX as number,
              action.params.startY as number,
              action.params.endX as number,
              action.params.endY as number
            );
          }
          break;

        case 'press_button':
          if ('button' in action.params) {
            await mcpClient.pressButton(action.params.button as 'home' | 'back');
          }
          break;

        case 'wait':
          const duration = (action.params.duration as number) ?? 1000;
          await new Promise((resolve) => setTimeout(resolve, duration));
          break;
      }

      return true;
    } catch (error) {
      console.error(`Action execution failed: ${error}`);
      return false;
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
- tap: Tap an element by ID or coordinates { "type": "tap", "params": { "element_id": "..." } } or { "type": "tap", "params": { "x": 100, "y": 200 } }
- type: Type text { "type": "type", "params": { "text": "..." } }
- scroll: Scroll in a direction { "type": "scroll", "params": { "direction": "up|down|left|right", "amount": 100 } }
- swipe: Swipe gesture { "type": "swipe", "params": { "startX": 100, "startY": 100, "endX": 200, "endY": 200 } }
- press_button: Press home or back { "type": "press_button", "params": { "button": "home|back" } }
- wait: Wait for duration { "type": "wait", "params": { "duration": 1000 } }

You will receive:
1. The navigation instruction (what screen/state to reach)
2. The current accessibility tree (UI structure)
3. History of actions already taken

Respond with JSON containing:
{
  "type": "action_type",
  "params": { /* action params */ },
  "reasoning": "Why you chose this action"
}

Be smart:
- Prefer tapping elements by ID when available
- Don't repeat failed actions
- Consider the current screen state
- Think step-by-step toward the goal`;
  }

  /**
   * Build user prompt for action planning
   */
  private buildPlanningUserPrompt(
    instruction: string,
    accessibilityTree: AccessibilityNode,
    actionHistory: ActionRecord[]
  ): string {
    const treeStr = this.serializeAccessibilityTree(accessibilityTree);
    const historyStr = actionHistory
      .map((a, i) => `${i + 1}. ${a.action} - ${a.reasoning} (${a.success ? '✓' : '✗'})`)
      .join('\n');

    return `Goal: ${instruction}

Current Screen:
${treeStr}

${actionHistory.length > 0 ? `Previous Actions:\n${historyStr}\n` : ''}
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
}
