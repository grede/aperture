/**
 * Template service - wraps TemplateEngine for web backend use
 */

import { TemplateEngine } from '../../templates/engine';
import { ensureWebEnvLoaded } from '../lib/env';
import type {
  TemplateStyle,
  TemplateDeviceType,
  TemplateFrameMode,
  TemplateBackground,
} from '../../types';

ensureWebEnvLoaded();

/**
 * Template service for generating marketing screenshots
 */
export class TemplateService {
  private engine: TemplateEngine;

  constructor() {
    this.engine = new TemplateEngine();
  }

  /**
   * Generate a marketing screenshot
   * @param screenshotBuffer - Original screenshot buffer
   * @param style - Template style to use
   * @param deviceType - Device type (iPhone, iPad, Android)
   * @param title - Marketing title
   * @param subtitle - Marketing subtitle (optional)
   * @param locale - Locale code
   * @param frameMode - Frame mode (default: minimal)
   * @returns Composited image buffer
   */
  async generateScreenshot(
    screenshotBuffer: Buffer,
    style: TemplateStyle,
    background: TemplateBackground | undefined,
    deviceType: TemplateDeviceType,
    title: string,
    subtitle: string,
    locale: string,
    frameMode: TemplateFrameMode = 'minimal',
    frameAssetFile?: string
  ): Promise<Buffer> {
    return this.engine.composite({
      screenshot: screenshotBuffer,
      style,
      background,
      deviceType,
      title,
      subtitle,
      locale,
      frameMode,
      frameAssetsDir: process.env.FRAME_ASSETS_DIR,
      realisticFrameFile: frameAssetFile,
    });
  }

  /**
   * Get available template styles
   * @returns Array of template style names
   */
  getAvailableStyles(): TemplateStyle[] {
    return this.engine.getAvailableStyles();
  }

  /**
   * Generate a preview image (for template selection)
   * @param screenshotBuffer - Screenshot buffer
   * @param style - Template style
   * @param deviceType - Device type
   * @param title - Sample title
   * @param subtitle - Sample subtitle
   * @param frameMode - Frame mode
   * @returns Preview image buffer
   */
  async generatePreview(
    screenshotBuffer: Buffer,
    style: TemplateStyle,
    background: TemplateBackground | undefined,
    deviceType: TemplateDeviceType,
    title: string,
    subtitle: string,
    frameMode: TemplateFrameMode = 'minimal',
    frameAssetFile?: string
  ): Promise<Buffer> {
    return this.engine.composite({
      screenshot: screenshotBuffer,
      style,
      background,
      deviceType,
      title,
      subtitle: subtitle || undefined,
      locale: 'en', // Preview always in English
      frameMode,
      frameAssetsDir: process.env.FRAME_ASSETS_DIR,
      realisticFrameFile: frameAssetFile,
    });
  }
}

/**
 * Singleton instance
 */
let templateServiceInstance: TemplateService | null = null;

/**
 * Get template service instance
 */
export function getTemplateService(): TemplateService {
  if (!templateServiceInstance) {
    templateServiceInstance = new TemplateService();
  }
  return templateServiceInstance;
}
