import sharp from 'sharp';
import type { CompositeOptions, TemplateStyle } from '../types/index.js';
import { minimalStyle, type StyleConfig } from './styles/minimal.js';
import { modernStyle } from './styles/modern.js';
import { gradientStyle } from './styles/gradient.js';
import { darkStyle } from './styles/dark.js';
import { playfulStyle } from './styles/playful.js';

// ── App Store Dimensions ───────────────────────────────────────

const APP_STORE_DIMENSIONS = {
  'iPhone': { width: 1242, height: 2688 }, // iPhone 6.5" (iPhone 15 Pro Max)
  'iPad': { width: 2048, height: 2732 },   // iPad 13" (iPad Pro)
};

// ── TemplateEngine Class ───────────────────────────────────────

export class TemplateEngine {
  private styles: Map<TemplateStyle, StyleConfig>;

  constructor() {
    this.styles = new Map([
      ['minimal', minimalStyle],
      ['modern', modernStyle],
      ['gradient', gradientStyle],
      ['dark', darkStyle],
      ['playful', playfulStyle],
    ]);
  }

  /**
   * Composite a screenshot into a store-ready marketing image
   */
  async composite(options: CompositeOptions): Promise<Buffer> {
    const style = this.styles.get(options.style);
    if (!style) {
      throw new Error(`Unknown style: ${options.style}`);
    }

    const dimensions = APP_STORE_DIMENSIONS[options.deviceType];

    // Load screenshot
    const screenshotImage = sharp(options.screenshot);
    const screenshotMeta = await screenshotImage.metadata();

    if (!screenshotMeta.width || !screenshotMeta.height) {
      throw new Error('Could not determine screenshot dimensions');
    }

    // Calculate screenshot dimensions to fit within canvas
    const maxScreenshotHeight = dimensions.height - style.deviceFramePadding * 2 -
      (style.textPosition === 'top' || style.textPosition === 'bottom' ? 200 : 0);
    const maxScreenshotWidth = dimensions.width - style.deviceFramePadding * 2;

    const screenshotAspect = screenshotMeta.width / screenshotMeta.height;
    const maxAspect = maxScreenshotWidth / maxScreenshotHeight;

    let screenshotWidth: number;
    let screenshotHeight: number;

    if (screenshotAspect > maxAspect) {
      // Width-constrained
      screenshotWidth = maxScreenshotWidth;
      screenshotHeight = Math.round(screenshotWidth / screenshotAspect);
    } else {
      // Height-constrained
      screenshotHeight = maxScreenshotHeight;
      screenshotWidth = Math.round(screenshotHeight * screenshotAspect);
    }

    // Resize screenshot
    const resizedScreenshot = await screenshotImage
      .resize(screenshotWidth, screenshotHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    // Create background
    let background: sharp.Sharp;

    if (options.style === 'modern' || options.style === 'gradient') {
      // Create gradient background
      background = await this.createGradientBackground(
        dimensions.width,
        dimensions.height,
        style.backgroundColor,
        options.style
      );
    } else {
      // Solid color background
      background = sharp({
        create: {
          width: dimensions.width,
          height: dimensions.height,
          channels: 3,
          background: style.backgroundColor,
        },
      });
    }

    // Position screenshot on canvas
    const screenshotX = Math.round((dimensions.width - screenshotWidth) / 2);
    const screenshotY = style.textPosition === 'top'
      ? dimensions.height - screenshotHeight - style.deviceFramePadding - 100
      : style.deviceFramePadding + 100;

    // Add text overlays
    const textSVG = this.createTextSVG(
      options.title,
      options.subtitle ?? '',
      dimensions.width,
      dimensions.height,
      style,
      screenshotY
    );

    // Sharp does not merge sequential composite() calls; pass both overlays together.
    const canvas = background.composite([
      {
        input: resizedScreenshot,
        top: screenshotY,
        left: screenshotX,
      },
      {
        input: Buffer.from(textSVG),
        top: 0,
        left: 0,
      },
    ]);

    // Export as PNG
    return canvas.png().toBuffer();
  }

  /**
   * Create a gradient background
   */
  private async createGradientBackground(
    width: number,
    height: number,
    baseColor: string,
    style: TemplateStyle
  ): Promise<sharp.Sharp> {
    // Generate gradient SVG
    const gradientSVG = style === 'modern'
      ? this.createModernGradient(width, height)
      : this.createBoldGradient(width, height);

    return sharp(Buffer.from(gradientSVG));
  }

  /**
   * Create modern gradient (subtle, diagonal)
   */
  private createModernGradient(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7B68EE;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad)" />
      </svg>
    `;
  }

  /**
   * Create bold gradient (vibrant, angled)
   */
  private createBoldGradient(width: number, height: number): string {
    return `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#FFD93D;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#6BCF7F;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad)" />
      </svg>
    `;
  }

  /**
   * Create SVG for text overlays
   */
  private createTextSVG(
    title: string,
    subtitle: string,
    canvasWidth: number,
    canvasHeight: number,
    style: StyleConfig,
    screenshotY: number
  ): string {
    const textY = style.textPosition === 'top'
      ? style.textPadding
      : screenshotY + 50; // Position below screenshot if bottom

    const titleY = textY + style.titleSize;
    const subtitleY = titleY + style.titleSize + 20;

    // Simple text wrapping for subtitle
    const maxCharsPerLine = 40;
    const subtitleLines = this.wrapText(subtitle, maxCharsPerLine);

    return `
      <svg width="${canvasWidth}" height="${canvasHeight}">
        <style>
          .title {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            font-size: ${style.titleSize}px;
            font-weight: 700;
            fill: ${style.textColor};
            text-anchor: middle;
          }
          .subtitle {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            font-size: ${style.subtitleSize}px;
            font-weight: 400;
            fill: ${style.textColor};
            text-anchor: middle;
            opacity: 0.9;
          }
        </style>
        <text x="${canvasWidth / 2}" y="${titleY}" class="title">${this.escapeXML(title)}</text>
        ${subtitleLines.map((line, i) =>
          `<text x="${canvasWidth / 2}" y="${subtitleY + i * (style.subtitleSize + 10)}" class="subtitle">${this.escapeXML(line)}</text>`
        ).join('')}
      </svg>
    `;
  }

  /**
   * Wrap text into multiple lines
   */
  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);

    return lines;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get list of available template styles
   */
  getAvailableStyles(): TemplateStyle[] {
    return Array.from(this.styles.keys());
  }
}
