import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import type {
  TemplateStyleDefinition,
  TemplateStyleName,
  ScreenshotExportConfig,
  ExportConfig,
  ExportResult,
  ScreenshotExportResult,
  ExportSize,
} from '../types/export.js';
import { EXPORT_SIZES } from '../types/export.js';
import { logger } from '../utils/logger.js';

/**
 * Template engine for compositing screenshots with device frames and text overlays (US-017)
 */
export class TemplateEngine {
  private stylesDir = path.join(process.cwd(), 'src/templates/styles');
  private assetsDir = path.join(process.cwd(), 'src/templates/assets');
  private cachedStyles: Map<TemplateStyleName, TemplateStyleDefinition> = new Map();

  /**
   * Load a template style by name
   */
  async loadStyle(styleName: TemplateStyleName): Promise<TemplateStyleDefinition> {
    // Check cache first
    if (this.cachedStyles.has(styleName)) {
      return this.cachedStyles.get(styleName)!;
    }

    // Load from file
    const stylePath = path.join(this.stylesDir, `${styleName}.json`);
    const styleContent = await fs.readFile(stylePath, 'utf-8');
    const style: TemplateStyleDefinition = JSON.parse(styleContent);

    // Cache and return
    this.cachedStyles.set(styleName, style);
    logger.debug({ styleName }, 'Template style loaded');
    return style;
  }

  /**
   * List all available template styles
   */
  async listStyles(): Promise<TemplateStyleName[]> {
    const files = await fs.readdir(this.stylesDir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', '') as TemplateStyleName);
  }

  /**
   * Composite a single screenshot with template style
   */
  async composite(config: ScreenshotExportConfig): Promise<Buffer> {
    const { screenshotPath, style, targetSize, translations } = config;

    logger.debug(
      { screenshot: screenshotPath, style: style.name, size: `${targetSize.width}x${targetSize.height}` },
      'Compositing screenshot'
    );

    // 1. Create background layer
    const background = await this.createBackground(style, targetSize);

    // 2. Load and resize screenshot to fit device frame display area
    const screenshot = await this.prepareScreenshot(screenshotPath, style, targetSize);

    // 3. Create device frame overlay (placeholder for now - will be SVG in production)
    // For MVP, we'll skip the actual device frame SVG and just composite screenshot + text

    // 4. Composite layers: background + screenshot
    let composite = sharp(background);

    // Position screenshot based on device frame display area
    const screenshotTop = Math.floor((targetSize.height * style.deviceFrame.displayArea.top) / 100);
    const screenshotLeft = Math.floor((targetSize.width * style.deviceFrame.displayArea.left) / 100);

    composite = composite.composite([
      {
        input: screenshot,
        top: screenshotTop,
        left: screenshotLeft,
      },
    ]);

    // 5. Add text overlays
    composite = await this.addTextOverlays(composite, style, targetSize, translations);

    // 6. Export as PNG (RGB, no alpha)
    const output = await composite.png({ compressionLevel: 9 }).toBuffer();

    logger.debug({ outputSize: output.length }, 'Screenshot composited');
    return output;
  }

  /**
   * Create background layer based on style
   */
  private async createBackground(style: TemplateStyleDefinition, size: ExportSize): Promise<Buffer> {
    const { background } = style;

    if (background.type === 'solid') {
      // Create solid color background
      return sharp({
        create: {
          width: size.width,
          height: size.height,
          channels: 3,
          background: background.color || '#FFFFFF',
        },
      })
        .png()
        .toBuffer();
    } else if (background.type === 'gradient') {
      // For gradient, we'll create a simple two-color vertical/diagonal gradient
      // In production, this could use SVG generation or pre-rendered gradient images
      const [color1] = background.gradientColors || ['#FFFFFF', '#F0F0F0'];

      // For now, create a solid color background (gradient implementation requires SVG or complex sharp operations)
      // TODO: Implement proper gradients using SVG or layered compositing
      return sharp({
        create: {
          width: size.width,
          height: size.height,
          channels: 3,
          background: color1,
        },
      })
        .png()
        .toBuffer();
    } else {
      // Image background
      const imagePath = path.join(this.assetsDir, 'backgrounds', background.imagePath || 'default.png');
      return sharp(imagePath).resize(size.width, size.height, { fit: 'cover' }).png().toBuffer();
    }
  }

  /**
   * Load and resize screenshot to fit within device frame display area
   */
  private async prepareScreenshot(screenshotPath: string, style: TemplateStyleDefinition, targetSize: ExportSize): Promise<Buffer> {
    const { displayArea } = style.deviceFrame;

    // Calculate target dimensions based on display area percentages
    const targetWidth = Math.floor((targetSize.width * displayArea.width) / 100);
    const targetHeight = Math.floor((targetSize.height * displayArea.height) / 100);

    // Load and resize screenshot
    const screenshot = await sharp(screenshotPath)
      .resize(targetWidth, targetHeight, {
        fit: 'contain', // Maintain aspect ratio, fit within bounds
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png()
      .toBuffer();

    return screenshot;
  }

  /**
   * Add text overlays to composite
   * Note: Sharp doesn't have native text rendering - in production we'd use SVG text or pre-rendered text images
   * For MVP, we'll skip text overlay implementation
   */
  private async addTextOverlays(
    composite: sharp.Sharp,
    _style: TemplateStyleDefinition,
    _targetSize: ExportSize,
    _translations: Record<string, string>
  ): Promise<sharp.Sharp> {
    // TODO: Implement text overlay using SVG text elements
    // For MVP, we'll return composite without text overlays
    // Production implementation would:
    // 1. Create SVG with text elements positioned per style.textOverlays
    // 2. Render SVG to PNG
    // 3. Composite on top of image

    logger.debug('Text overlays skipped in MVP implementation');
    return composite;
  }

  /**
   * Export all screenshots for a template across locales and devices
   */
  async exportAll(config: ExportConfig): Promise<ExportResult> {
    const startTime = Date.now();
    const results: ScreenshotExportResult[] = [];

    logger.info(
      { template: config.templateName, style: config.styleName, locales: config.locales, devices: config.devices },
      'Starting batch export'
    );

    // Load template style
    const style = await this.loadStyle(config.styleName);

    // For each locale × device × screenshot
    for (const locale of config.locales) {
      for (const deviceTarget of config.devices) {
        // Find screenshots for this locale
        const screenshotsDir = path.join(config.outputDir, config.templateName, locale);

        try {
          const files = await fs.readdir(screenshotsDir);
          const screenshotFiles = files.filter((f) => f.endsWith('.png'));

          for (const screenshotFile of screenshotFiles) {
            const screenshotPath = path.join(screenshotsDir, screenshotFile);
            const label = screenshotFile.replace('.png', '');

            // Load translations for this locale (placeholder - will be implemented in US-018)
            const translations = {
              title: `Screenshot ${label}`,
              subtitle: `Locale: ${locale}`,
            };

            try {
              // Composite screenshot
              const exportSize = (EXPORT_SIZES as any)[deviceTarget] as ExportSize;
              const composited = await this.composite({
                screenshotPath,
                label,
                locale,
                style,
                targetSize: exportSize,
                translations,
              });

              // Write output
              const outputPath = path.join(
                config.outputDir,
                'export',
                locale,
                deviceTarget,
                `${label}.png`
              );
              await fs.mkdir(path.dirname(outputPath), { recursive: true });
              await fs.writeFile(outputPath, composited);

              results.push({
                locale,
                device: deviceTarget,
                label,
                outputPath,
                fileSize: composited.length,
                success: true,
              });

              logger.info({ locale, device: deviceTarget, label, outputPath }, 'Screenshot exported');
            } catch (error) {
              logger.error({ locale, device: deviceTarget, label, error }, 'Failed to export screenshot');
              results.push({
                locale,
                device: deviceTarget,
                label,
                outputPath: '',
                fileSize: 0,
                success: false,
                error: (error as Error).message,
              });
            }
          }
        } catch (error) {
          logger.warn({ locale, device: deviceTarget, error }, 'Failed to read screenshots directory');
        }
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info(
      { template: config.templateName, successCount, failureCount, duration },
      'Batch export completed'
    );

    return {
      templateName: config.templateName,
      styleName: config.styleName,
      screenshots: results,
      successCount,
      failureCount,
      duration,
    };
  }
}

export const templateEngine = new TemplateEngine();
