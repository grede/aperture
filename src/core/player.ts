import type { Recording, Step, ElementSelector } from '../types/recording.js';
import type {
  PlaybackResult,
  StepResult,
  ResolvedSelector,
  SelectorCache,
} from '../types/player.js';
import { WDAConnection } from './wda-connection.js';
import { ScreenshotManager } from './screenshot.js';
import { StepFailedError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { retry, sleep } from '../utils/retry.js';
import { aiClient } from '../utils/ai-client.js';
import { selectorCacheManager } from './selector-cache.js';
import { sha256 } from '../utils/hash.js';

/**
 * Player options
 */
export interface PlayerOptions {
  /** Step timeout in seconds */
  stepTimeout?: number;
  /** Number of retries per step */
  stepRetries?: number;
  /** Enable AI fallback (not implemented yet) */
  enableAIFallback?: boolean;
  /** Output directory for screenshots */
  outputDir?: string;
  /** Hide status bar in screenshots */
  hideStatusBar?: boolean;
  /** Maximum steps per recording (US-015) */
  maxSteps?: number;
  /** Total run timeout in seconds (US-015) */
  runTimeout?: number;
  /** Forbidden action patterns (US-015) */
  forbiddenActions?: string[];
  /** Disable selector caching (US-016) */
  noCache?: boolean;
}

/**
 * Player for deterministic playback (US-005)
 */
export class Player {
  private wda: WDAConnection;
  private screenshot: ScreenshotManager;
  private options: Required<PlayerOptions>;
  private selectorCache: SelectorCache | null = null;

  constructor(wda: WDAConnection, udid: string, options: PlayerOptions = {}) {
    this.wda = wda;
    this.screenshot = new ScreenshotManager(udid);
    this.options = {
      stepTimeout: options.stepTimeout ?? 10,
      stepRetries: options.stepRetries ?? 2,
      enableAIFallback: options.enableAIFallback ?? false,
      outputDir: options.outputDir ?? './output',
      hideStatusBar: options.hideStatusBar ?? true,
      maxSteps: options.maxSteps ?? 50,
      runTimeout: options.runTimeout ?? 300,
      forbiddenActions: options.forbiddenActions ?? [],
      noCache: options.noCache ?? false,
    };
  }

  /**
   * Replay a recording (US-005)
   */
  async replay(recording: Recording, locale?: string): Promise<PlaybackResult> {
    logger.info(
      { recordingId: recording.id, locale, stepCount: recording.steps.length },
      'Starting playback'
    );

    // US-015: Check maxSteps guardrail
    if (recording.steps.length > this.options.maxSteps) {
      throw new StepFailedError(
        `Recording has ${recording.steps.length} steps, exceeding maxSteps limit of ${this.options.maxSteps}`,
        'MAX_STEPS_EXCEEDED',
        { stepCount: recording.steps.length, maxSteps: this.options.maxSteps }
      );
    }

    // US-016: Load selector cache if not disabled
    const templateHash = sha256(JSON.stringify(recording));
    if (!this.options.noCache) {
      this.selectorCache = await selectorCacheManager.load(recording.id, locale || 'default', templateHash);

      if (this.selectorCache) {
        logger.info(
          { recordingId: recording.id, locale, cachedSelectors: this.selectorCache.entries.length },
          'Using cached selectors'
        );
      } else {
        // Initialize new cache
        this.selectorCache = selectorCacheManager.initCache(recording.id, locale, templateHash);
      }
    }

    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    const screenshots: string[] = [];

    for (const step of recording.steps) {
      // US-015: Check runTimeout guardrail
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > this.options.runTimeout) {
        logger.error(
          { elapsed, timeout: this.options.runTimeout },
          'Run timeout exceeded, stopping playback'
        );
        break;
      }

      const result = await this.executeStep(step);
      stepResults.push(result);

      // Check if there's a screenshot point after this step
      const screenshotPoint = recording.screenshotPoints.find(
        (sp) => sp.afterStep === step.index
      );

      if (screenshotPoint && result.status === 'success') {
        // Capture screenshot (US-006)
        try {
          const outputDir = locale
            ? `${this.options.outputDir}/${recording.name}/${locale}`
            : `${this.options.outputDir}/${recording.name}`;

          const filepath = await this.screenshot.capture({
            outputDir,
            filename: screenshotPoint.label,
            hideStatusBar: this.options.hideStatusBar,
            delay: 1000, // Extra delay for screenshot
          });

          screenshots.push(filepath);
          logger.info({ label: screenshotPoint.label, filepath }, 'Screenshot captured');
        } catch (error) {
          logger.error(
            { label: screenshotPoint.label, error },
            'Failed to capture screenshot'
          );
        }
      }

      // Stop if step failed and no AI fallback
      if (result.status === 'failed' && !this.options.enableAIFallback) {
        logger.error({ stepIndex: step.index }, 'Step failed, stopping playback');
        break;
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const successCount = stepResults.filter((r) => r.status === 'success').length;
    const failureCount = stepResults.filter((r) => r.status === 'failed').length;
    const aiFallbackCount = stepResults.filter((r) => r.usedAIFallback).length;

    // US-016: Save selector cache if enabled and run was successful
    if (!this.options.noCache && this.selectorCache && failureCount === 0) {
      await selectorCacheManager.save(this.selectorCache);
      logger.info({ cacheEntries: this.selectorCache.entries.length }, 'Selector cache saved');
    }

    const result: PlaybackResult = {
      recordingId: recording.id,
      locale,
      steps: stepResults,
      screenshots,
      startTime,
      endTime,
      duration,
      successCount,
      failureCount,
      aiFallbackCount,
    };

    logger.info(
      {
        duration,
        successCount,
        failureCount,
        aiFallbackCount,
      },
      'Playback completed'
    );

    return result;
  }

  /**
   * Execute a single step with retry logic
   */
  private async executeStep(step: Step): Promise<StepResult> {
    const startTime = Date.now();

    logger.debug(
      { index: step.index, action: step.action },
      'Executing step'
    );

    // US-015: Check forbiddenActions guardrail
    if (this.options.forbiddenActions.length > 0) {
      const stepText = `${step.action} ${step.value || ''} ${step.selector.label || ''}`.toLowerCase();
      for (const forbidden of this.options.forbiddenActions) {
        if (stepText.includes(forbidden.toLowerCase())) {
          throw new StepFailedError(
            `Step contains forbidden action pattern: "${forbidden}"`,
            'FORBIDDEN_ACTION',
            { step, forbiddenPattern: forbidden }
          );
        }
      }
    }

    try {
      const resolved = await retry(
        async () => {
          return await this.resolveAndExecute(step);
        },
        {
          maxAttempts: this.options.stepRetries + 1,
          initialDelay: 1000,
          backoffMultiplier: 1, // Linear backoff for UI elements
          shouldRetry: (error) => {
            // Retry on element not found errors
            return error.message.includes('not found') || error.message.includes('timeout');
          },
        }
      );

      const duration = Date.now() - startTime;

      return {
        stepIndex: step.index,
        status: 'success',
        duration,
        selectorUsed: resolved.selector,
        usedAIFallback: resolved.usedAIFallback,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        { stepIndex: step.index, error, duration },
        'Step execution failed'
      );

      return {
        stepIndex: step.index,
        status: 'failed',
        duration,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Resolve element and execute action
   */
  private async resolveAndExecute(step: Step): Promise<ResolvedSelector> {
    // Try selector cascade: accessibilityId → accessibilityLabel → label → xpath
    const resolved = await this.resolveElement(step.selector, step.index);

    // Execute the action
    await this.executeAction(step, resolved);

    // Wait for UI to settle
    await sleep(500);

    // Verify step completed (US-013)
    await this.verifyStep(step);

    // US-016: Cache successful selector resolution
    if (this.selectorCache && resolved.method !== 'cached') {
      const originalSelector = JSON.stringify(step.selector);
      selectorCacheManager.addEntry(this.selectorCache, {
        stepIndex: step.index,
        originalSelector,
        resolvedSelector: resolved.selector,
        method: resolved.method,
        timestamp: Date.now(),
      });
    }

    return resolved;
  }

  /**
   * Verify step execution deterministically (US-013)
   */
  private async verifyStep(step: Step): Promise<void> {
    logger.debug({ stepIndex: step.index }, 'Verifying step');

    try {
      // Capture current accessibility tree
      const currentTree = await this.wda.getAccessibilityTree();

      // Basic verification: ensure tree is not empty (app is responsive)
      if (!currentTree || currentTree.trim().length === 0) {
        throw new StepFailedError(
          'Verification failed: Accessibility tree is empty (app may have crashed)',
          'VERIFICATION_FAILED',
          { stepIndex: step.index }
        );
      }

      const treeNormalized = currentTree.toLowerCase();

      // Check for common error indicators in the tree
      if (treeNormalized.includes('alert') || treeNormalized.includes('error occurred')) {
        logger.warn({ stepIndex: step.index }, 'Possible error dialog detected in accessibility tree');

        // Check for specific error keywords
        const errorKeywords = [
          'cannot connect',
          'network error',
          'server error',
          'invalid',
          'failed to',
        ];

        for (const keyword of errorKeywords) {
          if (treeNormalized.includes(keyword)) {
            throw new StepFailedError(
              `Verification failed: Error dialog detected with message containing "${keyword}"`,
              'VERIFICATION_FAILED',
              { stepIndex: step.index, keyword }
            );
          }
        }
      }

      // US-013: Check manual checkpoint assertions if defined
      if (step.checkpoint) {
        logger.debug({ stepIndex: step.index }, 'Checking manual checkpoint assertions');

        // Check required elements
        if (step.checkpoint.requiredElements) {
          for (const required of step.checkpoint.requiredElements) {
            if (!currentTree.includes(required)) {
              throw new StepFailedError(
                `Verification failed: Required element not found: "${required}"`,
                'VERIFICATION_FAILED',
                { stepIndex: step.index, requiredElement: required }
              );
            }
          }
        }

        // Check forbidden elements
        if (step.checkpoint.forbiddenElements) {
          for (const forbidden of step.checkpoint.forbiddenElements) {
            if (currentTree.includes(forbidden)) {
              throw new StepFailedError(
                `Verification failed: Forbidden element found: "${forbidden}"`,
                'VERIFICATION_FAILED',
                { stepIndex: step.index, forbiddenElement: forbidden }
              );
            }
          }
        }

        // Check expected screen
        if (step.checkpoint.expectedScreen) {
          if (!currentTree.includes(step.checkpoint.expectedScreen)) {
            throw new StepFailedError(
              `Verification failed: Expected screen not found: "${step.checkpoint.expectedScreen}"`,
              'VERIFICATION_FAILED',
              { stepIndex: step.index, expectedScreen: step.checkpoint.expectedScreen }
            );
          }
        }

        logger.debug({ stepIndex: step.index }, 'Checkpoint assertions passed');
      }

      logger.debug({ stepIndex: step.index }, 'Step verification passed');
    } catch (error) {
      if (error instanceof StepFailedError) {
        throw error;
      }

      // If we can't get the tree, it's likely a serious issue
      logger.error({ stepIndex: step.index, error }, 'Failed to verify step');
      throw new StepFailedError(
        'Verification failed: Could not capture accessibility tree',
        'VERIFICATION_FAILED',
        { stepIndex: step.index, error }
      );
    }
  }

  /**
   * Resolve element using selector cascade
   */
  private async resolveElement(selector: ElementSelector, stepIndex: number): Promise<ResolvedSelector> {
    const timeout = this.options.stepTimeout * 1000;

    // US-016: Check cache first if available
    if (this.selectorCache) {
      const cached = selectorCacheManager.getCachedSelector(this.selectorCache, stepIndex);
      if (cached) {
        logger.debug({ stepIndex, method: cached.method }, 'Using cached selector');

        try {
          let element;

          if (cached.method === 'accessibilityId' || cached.method === 'accessibilityLabel') {
            element = await this.wda.findByAccessibilityId(cached.resolvedSelector);
          } else if (cached.method === 'label') {
            const xpath = `//*[@label="${cached.resolvedSelector}"]`;
            element = await this.wda.findByXPath(xpath);
          } else {
            element = await this.wda.findByXPath(cached.resolvedSelector);
          }

          const exists = await element.waitForExist({ timeout });

          if (exists) {
            return {
              selector: cached.resolvedSelector,
              method: 'cached',
              usedAIFallback: false,
            };
          } else {
            logger.warn({ stepIndex }, 'Cached selector failed, falling back to cascade');
          }
        } catch (error) {
          logger.warn({ stepIndex, error }, 'Cached selector failed, falling back to cascade');
        }
      }
    }

    // 1. Try accessibilityIdentifier (most stable)
    if (selector.accessibilityIdentifier) {
      try {
        const element = await this.wda.findByAccessibilityId(selector.accessibilityIdentifier);
        const exists = await element.waitForExist({ timeout });

        if (exists) {
          return {
            selector: `~${selector.accessibilityIdentifier}`,
            method: 'accessibilityId',
            usedAIFallback: false,
          };
        }
      } catch (error) {
        logger.debug('AccessibilityId not found, trying next method');
      }
    }

    // 2. Try accessibilityLabel
    if (selector.accessibilityLabel) {
      try {
        const element = await this.wda.findByAccessibilityId(selector.accessibilityLabel);
        const exists = await element.waitForExist({ timeout });

        if (exists) {
          return {
            selector: `~${selector.accessibilityLabel}`,
            method: 'accessibilityLabel',
            usedAIFallback: false,
          };
        }
      } catch (error) {
        logger.debug('AccessibilityLabel not found, trying next method');
      }
    }

    // 3. Try label text
    if (selector.label) {
      try {
        const xpath = `//*[@label="${selector.label}"]`;
        const element = await this.wda.findByXPath(xpath);
        const exists = await element.waitForExist({ timeout });

        if (exists) {
          return {
            selector: xpath,
            method: 'label',
            usedAIFallback: false,
          };
        }
      } catch (error) {
        logger.debug('Label not found, trying next method');
      }
    }

    // 4. Try XPath
    if (selector.xpath) {
      try {
        const element = await this.wda.findByXPath(selector.xpath);
        const exists = await element.waitForExist({ timeout });

        if (exists) {
          return {
            selector: selector.xpath,
            method: 'xpath',
            usedAIFallback: false,
          };
        }
      } catch (error) {
        logger.debug('XPath not found');
      }
    }

    // 5. AI fallback (US-012)
    if (this.options.enableAIFallback) {
      logger.info({ selector }, 'Trying AI fallback for element location');

      try {
        const aiResolved = await this.tryAIFallback(selector);
        return aiResolved;
      } catch (error) {
        logger.error({ selector, error }, 'AI fallback failed');
        throw new StepFailedError(
          'Element not found even with AI fallback: ' + (error as Error).message,
          'AI_FALLBACK_FAILED',
          { selector, error }
        );
      }
    }

    throw new StepFailedError(
      'Element not found using any selector method',
      'SELECTOR_NOT_FOUND',
      { selector }
    );
  }

  /**
   * Try to locate element using AI fallback (US-012)
   */
  private async tryAIFallback(originalSelector: ElementSelector): Promise<ResolvedSelector> {
    logger.debug('Capturing accessibility tree for AI analysis');

    // Get current accessibility tree
    const accessibilityTree = await this.wda.getAccessibilityTree();

    // Build AI prompt
    const systemPrompt = this.buildAIFallbackSystemPrompt();
    const userPrompt = this.buildAIFallbackUserPrompt(originalSelector, accessibilityTree);

    // Try GPT-4o-mini first (or configured model)
    let model: string = 'gpt-4o-mini';
    let response;

    try {
      logger.debug('Trying GPT-4o-mini for element location');
      response = await aiClient.complete({
        systemPrompt,
        userPrompt,
        temperature: 0.3, // Lower temperature for consistency
        responseFormat: 'json',
      });
    } catch (error) {
      // Fallback to GPT-4o
      logger.info('GPT-4o-mini failed, trying GPT-4o');
      model = 'gpt-4o';

      // Reinitialize with gpt-4o as primary model temporarily
      const currentConfig = aiClient['config'];
      aiClient.initialize({ ...currentConfig, model: 'gpt-4o' });

      response = await aiClient.complete({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        responseFormat: 'json',
      });

      // Restore original model
      aiClient.initialize(currentConfig);
    }

    // Parse AI response
    const aiResponse = aiClient.parseJSON<{
      selector: string;
      method: 'accessibilityId' | 'label' | 'xpath';
      reasoning: string;
    }>(response.content);

    logger.info(
      { model, selector: aiResponse.selector, method: aiResponse.method, reasoning: aiResponse.reasoning },
      'AI suggested element selector'
    );

    // Try to locate element with AI-suggested selector
    const timeout = this.options.stepTimeout * 1000;

    try {
      let element;

      if (aiResponse.method === 'accessibilityId') {
        element = await this.wda.findByAccessibilityId(aiResponse.selector);
      } else if (aiResponse.method === 'label') {
        const xpath = `//*[@label="${aiResponse.selector}"]`;
        element = await this.wda.findByXPath(xpath);
      } else {
        element = await this.wda.findByXPath(aiResponse.selector);
      }

      const exists = await element.waitForExist({ timeout });

      if (exists) {
        logger.info('AI fallback successfully located element');
        return {
          selector: aiResponse.selector,
          method: aiResponse.method,
          usedAIFallback: true,
          aiModel: model,
        };
      } else {
        throw new Error('AI-suggested element does not exist');
      }
    } catch (error) {
      throw new Error(`Failed to locate element with AI-suggested selector: ${aiResponse.selector}`);
    }
  }

  /**
   * Build system prompt for AI element location
   */
  private buildAIFallbackSystemPrompt(): string {
    return `You are an expert at analyzing iOS accessibility trees and locating UI elements.

Your task is to find a UI element in the iOS accessibility tree based on the original selector that failed.

Return your response as JSON with:
{
  "selector": "the accessibilityId, label text, or xpath to use",
  "method": "accessibilityId" | "label" | "xpath",
  "reasoning": "brief explanation of why this element matches"
}

Guidelines:
- Prefer accessibilityId if available (most stable)
- Use label text for buttons and text elements
- Use xpath only as last resort
- Look for elements with similar labels, roles, or hierarchy
- Consider that text may have changed slightly but UI structure is similar`;
  }

  /**
   * Build user prompt for AI element location
   */
  private buildAIFallbackUserPrompt(selector: ElementSelector, accessibilityTree: string): string {
    return `I'm trying to locate a UI element that was originally identified with these selectors:

${selector.accessibilityIdentifier ? `- accessibilityId: "${selector.accessibilityIdentifier}"` : ''}
${selector.accessibilityLabel ? `- accessibilityLabel: "${selector.accessibilityLabel}"` : ''}
${selector.label ? `- label: "${selector.label}"` : ''}
${selector.elementType ? `- elementType: "${selector.elementType}"` : ''}

None of these selectors worked. Here's the current accessibility tree:

\`\`\`xml
${accessibilityTree}
\`\`\`

Please analyze the tree and suggest the best selector to locate this element. Return as JSON.`;
  }

  /**
   * Execute action on resolved element
   */
  private async executeAction(step: Step, resolved: ResolvedSelector): Promise<void> {
    logger.debug(
      { action: step.action, method: resolved.method },
      'Executing action'
    );

    switch (step.action) {
      case 'tap': {
        if (step.selector.bounds) {
          // Use coordinates if available
          const [x, y, width, height] = step.selector.bounds;
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          await this.wda.tap(centerX, centerY);
        } else {
          // Find and tap element
          const element = await this.wda.getBrowser().$(resolved.selector);
          await element.click();
        }
        break;
      }

      case 'type': {
        if (!step.value) {
          throw new Error('Type action requires value');
        }
        await this.wda.type(step.value);
        break;
      }

      case 'swipe': {
        if (!step.selector.bounds) {
          throw new Error('Swipe action requires bounds');
        }
        const [x, y, width, height] = step.selector.bounds;
        const startX = x + width / 2;
        const startY = y + height / 2;
        const endX = startX;
        const endY = startY - 100; // Swipe up by default
        await this.wda.swipe(startX, startY, endX, endY);
        break;
      }

      case 'scroll': {
        // Implement scroll logic
        const screenSize = await this.wda.getScreenSize();
        const startY = screenSize.height * 0.8;
        const endY = screenSize.height * 0.2;
        await this.wda.swipe(screenSize.width / 2, startY, screenSize.width / 2, endY, 500);
        break;
      }

      case 'back': {
        await this.wda.goBack();
        break;
      }

      case 'home': {
        await this.wda.pressHome();
        break;
      }

      case 'wait': {
        const duration = step.value ? parseInt(step.value, 10) : 1000;
        await sleep(duration);
        break;
      }

      default:
        throw new Error(`Unknown action type: ${step.action}`);
    }

    // Brief wait after action
    await sleep(300);
  }
}
