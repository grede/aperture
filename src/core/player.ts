import type { Recording, Step, ElementSelector } from '../types/recording.js';
import type {
  PlaybackResult,
  StepResult,
  ResolvedSelector,
} from '../types/player.js';
import { WDAConnection } from './wda-connection.js';
import { ScreenshotManager } from './screenshot.js';
import { StepFailedError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { retry, sleep } from '../utils/retry.js';

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
}

/**
 * Player for deterministic playback (US-005)
 */
export class Player {
  private wda: WDAConnection;
  private screenshot: ScreenshotManager;
  private options: Required<PlayerOptions>;

  constructor(wda: WDAConnection, udid: string, options: PlayerOptions = {}) {
    this.wda = wda;
    this.screenshot = new ScreenshotManager(udid);
    this.options = {
      stepTimeout: options.stepTimeout ?? 10,
      stepRetries: options.stepRetries ?? 2,
      enableAIFallback: options.enableAIFallback ?? false,
      outputDir: options.outputDir ?? './output',
      hideStatusBar: options.hideStatusBar ?? true,
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

    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    const screenshots: string[] = [];

    for (const step of recording.steps) {
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
    const resolved = await this.resolveElement(step.selector);

    // Execute the action
    await this.executeAction(step, resolved);

    // Verify step completed (basic verification for now)
    await sleep(500); // Brief wait for UI to settle

    return resolved;
  }

  /**
   * Resolve element using selector cascade
   */
  private async resolveElement(selector: ElementSelector): Promise<ResolvedSelector> {
    const timeout = this.options.stepTimeout * 1000;

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

    // 5. AI fallback (placeholder - not implemented in MVP)
    if (this.options.enableAIFallback) {
      logger.warn('AI fallback not yet implemented');
      throw new StepFailedError(
        'Element not found and AI fallback not available',
        'SELECTOR_NOT_FOUND',
        { selector }
      );
    }

    throw new StepFailedError(
      'Element not found using any selector method',
      'SELECTOR_NOT_FOUND',
      { selector }
    );
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
