import fs from 'fs/promises';
import path from 'path';
import { simctl } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  /** Output directory */
  outputDir: string;
  /** Filename (without extension) */
  filename: string;
  /** Hide status bar */
  hideStatusBar?: boolean;
  /** Add delay before capture (ms) */
  delay?: number;
}

/**
 * Screenshot manager for capturing device screens (US-006)
 */
export class ScreenshotManager {
  private udid: string;

  constructor(udid: string) {
    this.udid = udid;
  }

  /**
   * Capture screenshot from Simulator
   */
  async capture(options: ScreenshotOptions): Promise<string> {
    const { outputDir, filename, hideStatusBar = true, delay = 500 } = options;

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Hide status bar if requested
    if (hideStatusBar) {
      await this.setStatusBarOverride(true);
    }

    // Wait for UI to stabilize
    await sleep(delay);

    // Capture screenshot
    const filepath = path.join(outputDir, `${filename}.png`);
    const result = await simctl(['io', this.udid, 'screenshot', filepath]);

    if (result.exitCode !== 0) {
      logger.error({ filepath, stderr: result.stderr }, 'Screenshot capture failed');
      throw new Error(`Failed to capture screenshot: ${result.stderr}`);
    }

    // Restore status bar
    if (hideStatusBar) {
      await this.setStatusBarOverride(false);
    }

    logger.info({ filepath }, 'Screenshot captured');
    return filepath;
  }

  /**
   * Capture multiple screenshots
   */
  async captureMultiple(
    screenshots: Array<{ filename: string; delay?: number }>,
    outputDir: string,
    hideStatusBar = true
  ): Promise<string[]> {
    const filepaths: string[] = [];

    for (const screenshot of screenshots) {
      const filepath = await this.capture({
        outputDir,
        filename: screenshot.filename,
        hideStatusBar,
        delay: screenshot.delay,
      });
      filepaths.push(filepath);
    }

    return filepaths;
  }

  /**
   * Set status bar override (hide/show)
   */
  private async setStatusBarOverride(hide: boolean): Promise<void> {
    if (hide) {
      // Override with clean status bar
      const result = await simctl([
        'status_bar',
        this.udid,
        'override',
        '--time',
        '9:41',
        '--batteryState',
        'charged',
        '--batteryLevel',
        '100',
        '--wifiBars',
        '3',
        '--cellularMode',
        'active',
        '--cellularBars',
        '4',
      ]);

      if (result.exitCode !== 0) {
        logger.warn('Failed to override status bar');
      }
    } else {
      // Clear override
      await simctl(['status_bar', this.udid, 'clear']);
    }
  }

  /**
   * Get screenshot dimensions
   */
  async getDimensions(): Promise<{ width: number; height: number }> {
    // Capture a temporary screenshot to get dimensions
    const tmpFile = `/tmp/aperture-screenshot-${Date.now()}.png`;
    await simctl(['io', this.udid, 'screenshot', tmpFile]);

    // Read image dimensions (would need sharp for this)
    // For now, return common iOS dimensions
    // TODO: Implement actual dimension detection

    // Clean up temp file
    await fs.unlink(tmpFile).catch(() => {});

    // Return placeholder dimensions (1290x2796 for iPhone 15 Pro Max)
    return { width: 1290, height: 2796 };
  }

  /**
   * Batch capture screenshots at intervals
   */
  async captureSequence(
    count: number,
    interval: number,
    outputDir: string,
    baseFilename: string
  ): Promise<string[]> {
    const filepaths: string[] = [];

    for (let i = 0; i < count; i++) {
      const filename = `${baseFilename}-${i + 1}`;
      const filepath = await this.capture({
        outputDir,
        filename,
        hideStatusBar: true,
        delay: 0,
      });

      filepaths.push(filepath);

      if (i < count - 1) {
        await sleep(interval);
      }
    }

    return filepaths;
  }
}

/**
 * Create screenshot manager for a device
 */
export function createScreenshotManager(udid: string): ScreenshotManager {
  return new ScreenshotManager(udid);
}
