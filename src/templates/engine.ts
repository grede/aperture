import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import type {
  CompositeOptions,
  TemplateDeviceType,
  TemplateStyle,
} from '../types/index.js';
import { minimalStyle, type StyleConfig } from './styles/minimal.js';
import { modernStyle } from './styles/modern.js';
import { gradientStyle } from './styles/gradient.js';
import { darkStyle } from './styles/dark.js';
import { playfulStyle } from './styles/playful.js';

const EXPORT_DIMENSIONS: Record<TemplateDeviceType, { width: number; height: number }> = {
  'iPhone': { width: 1242, height: 2688 }, // iPhone 6.5" (iPhone 15 Pro Max)
  'iPad': { width: 2048, height: 2732 },   // iPad 13" (iPad Pro)
  'Android': { width: 1080, height: 1920 }, // Google Play portrait baseline
};

interface VisualRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FittedRect {
  width: number;
  height: number;
}

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

interface MinimalFramePreset {
  outerAspect: number;
  screenXRatio: number;
  screenYRatio: number;
  screenWidthRatio: number;
  screenHeightRatio: number;
  outerCornerRadiusRatio: number;
  screenCornerRadiusRatio: number;
  bodyStartColor: string;
  bodyEndColor: string;
  borderColor: string;
  innerBorderColor: string;
  topAccent: 'none' | 'speaker' | 'punch-hole';
}

interface RealisticFrameAsset {
  overlay: Buffer;
  overlayWidth: number;
  overlayHeight: number;
  screen: ScreenRect;
}

interface LayerResult {
  layers: sharp.OverlayOptions[];
  contentBottom: number;
}

const MINIMAL_FRAME_PRESETS: Record<TemplateDeviceType, MinimalFramePreset> = {
  'iPhone': {
    outerAspect: 430 / 932,
    screenXRatio: 0.043,
    screenYRatio: 0.03,
    screenWidthRatio: 0.915,
    screenHeightRatio: 0.917,
    outerCornerRadiusRatio: 0.085,
    screenCornerRadiusRatio: 0.07,
    bodyStartColor: '#1D232E',
    bodyEndColor: '#10141C',
    borderColor: '#3A4252',
    innerBorderColor: '#0D1118',
    topAccent: 'speaker',
  },
  'iPad': {
    outerAspect: 3 / 4,
    screenXRatio: 0.04,
    screenYRatio: 0.04,
    screenWidthRatio: 0.92,
    screenHeightRatio: 0.92,
    outerCornerRadiusRatio: 0.045,
    screenCornerRadiusRatio: 0.035,
    bodyStartColor: '#222832',
    bodyEndColor: '#141922',
    borderColor: '#454D5E',
    innerBorderColor: '#0D1118',
    topAccent: 'none',
  },
  'Android': {
    outerAspect: 9 / 19.5,
    screenXRatio: 0.05,
    screenYRatio: 0.05,
    screenWidthRatio: 0.9,
    screenHeightRatio: 0.9,
    outerCornerRadiusRatio: 0.08,
    screenCornerRadiusRatio: 0.06,
    bodyStartColor: '#1C1C1F',
    bodyEndColor: '#101013',
    borderColor: '#3C3C44',
    innerBorderColor: '#0A0A0C',
    topAccent: 'punch-hole',
  },
};

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

    const dimensions = EXPORT_DIMENSIONS[options.deviceType];
    if (!dimensions) {
      throw new Error(`Unsupported device type: ${options.deviceType}`);
    }

    const screenshotMeta = await sharp(options.screenshot).metadata();

    if (!screenshotMeta.width || !screenshotMeta.height) {
      throw new Error('Could not determine screenshot dimensions');
    }

    // Create background
    let background: sharp.Sharp;

    if (options.style === 'modern' || options.style === 'gradient') {
      // Create gradient background
      background = await this.createGradientBackground(
        dimensions.width,
        dimensions.height,
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

    const visualRegion = this.getVisualRegion(dimensions.width, dimensions.height, style);
    const frameMode = options.frameMode ?? 'minimal';

    const layerResult = frameMode === 'none'
      ? await this.createNoFrameLayers(options, screenshotMeta, visualRegion)
      : await this.createFramedLayers(options, visualRegion);

    const textSVG = this.createTextSVG(
      options.title,
      options.subtitle ?? '',
      dimensions.width,
      dimensions.height,
      style,
      layerResult.contentBottom
    );

    const canvas = background.composite([
      ...layerResult.layers,
      { input: Buffer.from(textSVG), top: 0, left: 0 },
    ]);

    // Export as PNG
    return canvas.png().toBuffer();
  }

  private getVisualRegion(canvasWidth: number, canvasHeight: number, style: StyleConfig): VisualRegion {
    const textReserve = style.textPosition === 'top' || style.textPosition === 'bottom' ? 240 : 0;
    const left = style.deviceFramePadding;
    const width = canvasWidth - style.deviceFramePadding * 2;
    let top = style.deviceFramePadding;
    let height = canvasHeight - style.deviceFramePadding * 2;

    if (style.textPosition === 'top') {
      top += textReserve;
      height -= textReserve;
    } else if (style.textPosition === 'bottom') {
      height -= textReserve;
    }

    return { left, top, width, height };
  }

  private fitAspect(aspectRatio: number, maxWidth: number, maxHeight: number): FittedRect {
    const maxAspect = maxWidth / maxHeight;
    if (aspectRatio > maxAspect) {
      const width = maxWidth;
      return { width, height: Math.round(width / aspectRatio) };
    }

    const height = maxHeight;
    return { width: Math.round(height * aspectRatio), height };
  }

  private async createNoFrameLayers(
    options: CompositeOptions,
    screenshotMeta: sharp.Metadata,
    visualRegion: VisualRegion
  ): Promise<LayerResult> {
    const screenshotAspect = (screenshotMeta.width ?? 1) / (screenshotMeta.height ?? 1);
    const fitted = this.fitAspect(screenshotAspect, visualRegion.width, visualRegion.height);
    const left = visualRegion.left + Math.round((visualRegion.width - fitted.width) / 2);
    const top = visualRegion.top + Math.round((visualRegion.height - fitted.height) / 2);

    const screenshotLayer = await sharp(options.screenshot)
      .resize(fitted.width, fitted.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    return {
      layers: [{ input: screenshotLayer, left, top }],
      contentBottom: top + fitted.height,
    };
  }

  private async createFramedLayers(
    options: CompositeOptions,
    visualRegion: VisualRegion
  ): Promise<LayerResult> {
    const frameMode = options.frameMode ?? 'minimal';

    if (frameMode === 'realistic') {
      const realisticLayers = await this.createRealisticFrameLayers(options, visualRegion);
      if (realisticLayers) return realisticLayers;
    }

    return this.createMinimalFrameLayers(options, visualRegion);
  }

  private async createMinimalFrameLayers(
    options: CompositeOptions,
    visualRegion: VisualRegion
  ): Promise<LayerResult> {
    const preset = MINIMAL_FRAME_PRESETS[options.deviceType];
    const frame = this.fitAspect(preset.outerAspect, visualRegion.width, visualRegion.height);
    const frameLeft = visualRegion.left + Math.round((visualRegion.width - frame.width) / 2);
    const frameTop = visualRegion.top + Math.round((visualRegion.height - frame.height) / 2);
    const screen = this.resolveMinimalScreenRect(frame.width, frame.height, preset);

    const maskedScreenshot = await this.resizeAndMaskScreenshot(
      options.screenshot,
      screen.width,
      screen.height,
      screen.cornerRadius
    );

    return {
      layers: [
        {
          input: Buffer.from(this.createMinimalFrameBodySVG(frame.width, frame.height, preset)),
          left: frameLeft,
          top: frameTop,
        },
        {
          input: Buffer.from(this.createScreenBackdropSVG(frame.width, frame.height, screen)),
          left: frameLeft,
          top: frameTop,
        },
        {
          input: maskedScreenshot,
          left: frameLeft + screen.x,
          top: frameTop + screen.y,
        },
        {
          input: Buffer.from(this.createMinimalFrameOverlaySVG(frame.width, frame.height, preset, screen)),
          left: frameLeft,
          top: frameTop,
        },
      ],
      contentBottom: frameTop + frame.height,
    };
  }

  private async createRealisticFrameLayers(
    options: CompositeOptions,
    visualRegion: VisualRegion
  ): Promise<LayerResult | null> {
    const frameAsset = await this.loadRealisticFrameAsset(options.deviceType, options.frameAssetsDir);
    if (!frameAsset) {
      return null;
    }

    const frame = this.fitAspect(
      frameAsset.overlayWidth / frameAsset.overlayHeight,
      visualRegion.width,
      visualRegion.height
    );
    const frameLeft = visualRegion.left + Math.round((visualRegion.width - frame.width) / 2);
    const frameTop = visualRegion.top + Math.round((visualRegion.height - frame.height) / 2);
    const scaleX = frame.width / frameAsset.overlayWidth;
    const scaleY = frame.height / frameAsset.overlayHeight;
    const screen = {
      x: Math.round(frameAsset.screen.x * scaleX),
      y: Math.round(frameAsset.screen.y * scaleY),
      width: Math.round(frameAsset.screen.width * scaleX),
      height: Math.round(frameAsset.screen.height * scaleY),
      cornerRadius: Math.max(
        0,
        Math.round(frameAsset.screen.cornerRadius * ((scaleX + scaleY) / 2))
      ),
    };

    const maskedScreenshot = await this.resizeAndMaskScreenshot(
      options.screenshot,
      screen.width,
      screen.height,
      screen.cornerRadius
    );
    const resizedOverlay = await sharp(frameAsset.overlay)
      .resize(frame.width, frame.height, { fit: 'fill' })
      .png()
      .toBuffer();

    return {
      layers: [
        {
          input: Buffer.from(this.createScreenBackdropSVG(frame.width, frame.height, screen)),
          left: frameLeft,
          top: frameTop,
        },
        {
          input: maskedScreenshot,
          left: frameLeft + screen.x,
          top: frameTop + screen.y,
        },
        {
          input: resizedOverlay,
          left: frameLeft,
          top: frameTop,
        },
      ],
      contentBottom: frameTop + frame.height,
    };
  }

  private async loadRealisticFrameAsset(
    deviceType: TemplateDeviceType,
    assetsDir?: string
  ): Promise<RealisticFrameAsset | null> {
    if (!assetsDir) return null;

    const deviceKey = deviceType.toLowerCase();
    const framePath = join(assetsDir, `${deviceKey}.png`);
    const metadataPath = join(assetsDir, `${deviceKey}.json`);

    try {
      const [overlay, metadataJSON] = await Promise.all([
        readFile(framePath),
        readFile(metadataPath, 'utf-8'),
      ]);
      const overlayMeta = await sharp(overlay).metadata();
      if (!overlayMeta.width || !overlayMeta.height) {
        return null;
      }

      const parsed = JSON.parse(metadataJSON) as { screen?: Partial<ScreenRect> };
      const screen = this.parseScreenRect(parsed.screen);
      if (!screen) {
        return null;
      }

      return {
        overlay,
        overlayWidth: overlayMeta.width,
        overlayHeight: overlayMeta.height,
        screen,
      };
    } catch {
      return null;
    }
  }

  private parseScreenRect(screen?: Partial<ScreenRect>): ScreenRect | null {
    if (!screen) return null;

    const x = Number(screen.x);
    const y = Number(screen.y);
    const width = Number(screen.width);
    const height = Number(screen.height);
    const cornerRadius = Number(screen.cornerRadius ?? 0);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }
    if (width <= 0 || height <= 0 || x < 0 || y < 0) {
      return null;
    }

    return { x, y, width, height, cornerRadius: Math.max(0, cornerRadius) };
  }

  private resolveMinimalScreenRect(
    frameWidth: number,
    frameHeight: number,
    preset: MinimalFramePreset
  ): ScreenRect {
    const width = Math.round(frameWidth * preset.screenWidthRatio);
    const height = Math.round(frameHeight * preset.screenHeightRatio);
    const x = Math.round(frameWidth * preset.screenXRatio);
    const y = Math.round(frameHeight * preset.screenYRatio);
    const cornerRadius = Math.round(Math.min(width, height) * preset.screenCornerRadiusRatio);

    return { x, y, width, height, cornerRadius };
  }

  private async resizeAndMaskScreenshot(
    screenshot: Buffer,
    width: number,
    height: number,
    cornerRadius: number
  ): Promise<Buffer> {
    const resized = await sharp(screenshot)
      .resize(width, height, {
        fit: 'contain',
        position: 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const mask = Buffer.from(`
      <svg width="${width}" height="${height}">
        <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
        <rect x="0" y="0" width="${width}" height="${height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff" />
      </svg>
    `);

    return sharp(resized)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  private createScreenBackdropSVG(
    frameWidth: number,
    frameHeight: number,
    screen: ScreenRect
  ): string {
    return `
      <svg width="${frameWidth}" height="${frameHeight}">
        <rect
          x="${screen.x}"
          y="${screen.y}"
          width="${screen.width}"
          height="${screen.height}"
          rx="${screen.cornerRadius}"
          ry="${screen.cornerRadius}"
          fill="#05070B"
        />
      </svg>
    `;
  }

  private createMinimalFrameBodySVG(
    frameWidth: number,
    frameHeight: number,
    preset: MinimalFramePreset
  ): string {
    const cornerRadius = Math.round(Math.min(frameWidth, frameHeight) * preset.outerCornerRadiusRatio);

    return `
      <svg width="${frameWidth}" height="${frameHeight}">
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${preset.bodyStartColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${preset.bodyEndColor};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${frameWidth}" height="${frameHeight}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#bodyGrad)" />
      </svg>
    `;
  }

  private createMinimalFrameOverlaySVG(
    frameWidth: number,
    frameHeight: number,
    preset: MinimalFramePreset,
    screen: ScreenRect
  ): string {
    const outerRadius = Math.round(Math.min(frameWidth, frameHeight) * preset.outerCornerRadiusRatio);
    const outerStrokeWidth = Math.max(2, Math.round(frameWidth * 0.004));
    const screenStrokeWidth = Math.max(2, Math.round(frameWidth * 0.0025));

    const speakerAccent = preset.topAccent === 'speaker'
      ? `<rect x="${Math.round(frameWidth * 0.35)}" y="${Math.round(frameHeight * 0.012)}" width="${Math.round(frameWidth * 0.30)}" height="${Math.max(8, Math.round(frameHeight * 0.01))}" rx="${Math.round(frameWidth * 0.02)}" fill="#0A0D12" opacity="0.85" />`
      : '';

    const punchHole = preset.topAccent === 'punch-hole'
      ? `<circle cx="${screen.x + Math.round(screen.width / 2)}" cy="${screen.y + Math.round(screen.height * 0.03)}" r="${Math.max(6, Math.round(frameWidth * 0.015))}" fill="#0B0B0D" opacity="0.9" />`
      : '';

    return `
      <svg width="${frameWidth}" height="${frameHeight}">
        <rect
          x="${Math.round(outerStrokeWidth / 2)}"
          y="${Math.round(outerStrokeWidth / 2)}"
          width="${frameWidth - outerStrokeWidth}"
          height="${frameHeight - outerStrokeWidth}"
          rx="${Math.max(0, outerRadius - Math.round(outerStrokeWidth / 2))}"
          ry="${Math.max(0, outerRadius - Math.round(outerStrokeWidth / 2))}"
          fill="none"
          stroke="${preset.borderColor}"
          stroke-width="${outerStrokeWidth}"
        />
        <rect
          x="${screen.x}"
          y="${screen.y}"
          width="${screen.width}"
          height="${screen.height}"
          rx="${screen.cornerRadius}"
          ry="${screen.cornerRadius}"
          fill="none"
          stroke="${preset.innerBorderColor}"
          stroke-width="${screenStrokeWidth}"
          opacity="0.85"
        />
        ${speakerAccent}
        ${punchHole}
      </svg>
    `;
  }

  /**
   * Create a gradient background
   */
  private async createGradientBackground(
    width: number,
    height: number,
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
    contentBottom: number
  ): string {
    // Simple text wrapping for subtitle
    const maxCharsPerLine = 40;
    const subtitleLines = this.wrapText(subtitle, maxCharsPerLine);
    const subtitleBlockHeight = subtitleLines.length > 0
      ? style.subtitleSize + (subtitleLines.length - 1) * (style.subtitleSize + 10)
      : 0;

    const topTitleY = style.textPadding + style.titleSize;
    const bottomTitleTarget = contentBottom + style.textPadding + style.titleSize;
    const bottomSafeLimit = canvasHeight - style.textPadding - subtitleBlockHeight - 14;
    const titleY = style.textPosition === 'top'
      ? topTitleY
      : Math.min(bottomTitleTarget, bottomSafeLimit);
    const subtitleY = titleY + style.titleSize + 14;

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
    if (!text || text.trim().length === 0) {
      return [];
    }

    const words = text.trim().split(/\s+/);
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
