import sharp from 'sharp';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type {
  CompositeOptions,
  TemplateBackground,
  TemplateDeviceType,
  TemplateStyle,
  TemplateTextStyle,
} from '../types/index.js';
import { minimalStyle, type StyleConfig } from './styles/minimal.js';
import { modernStyle } from './styles/modern.js';
import { gradientStyle } from './styles/gradient.js';
import { darkStyle } from './styles/dark.js';
import { playfulStyle } from './styles/playful.js';
import { resolveRealisticFrameAsset } from './realistic-frame-assets.js';

const require = createRequire(import.meta.url);

const EXPORT_DIMENSIONS: Record<TemplateDeviceType, { width: number; height: number }> = {
  iPhone: { width: 1242, height: 2688 }, // iPhone 6.5" (iPhone 15 Pro Max)
  iPad: { width: 2048, height: 2732 }, // iPad 13" (iPad Pro)
  Android: { width: 1080, height: 1920 }, // Google Play portrait baseline
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

interface TextRenderStyle extends StyleConfig {
  fontFamily: string;
  fontFaceCSS: string;
}

type TemplateFontFamily = NonNullable<TemplateTextStyle['fontFamily']>;
type FontWeight = 400 | 700;

interface FontSourceDescriptor {
  packageName: string;
  familyName: string;
}

const MINIMAL_FRAME_PRESETS: Record<TemplateDeviceType, MinimalFramePreset> = {
  iPhone: {
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
  iPad: {
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
  Android: {
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

const FONT_FAMILY_STACKS: Record<TemplateFontFamily, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  georgia: "Georgia, 'Times New Roman', Times, serif",
  avenir: "Avenir Next, Avenir, 'Segoe UI', Helvetica, Arial, sans-serif",
  courier: "'Courier New', Courier, monospace",
  inter: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif",
  roboto: "Roboto, 'Segoe UI', Helvetica, Arial, sans-serif",
  open_sans: "'Open Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  poppins: "Poppins, 'Segoe UI', Helvetica, Arial, sans-serif",
  montserrat: "Montserrat, 'Segoe UI', Helvetica, Arial, sans-serif",
  lato: "Lato, 'Segoe UI', Helvetica, Arial, sans-serif",
  oswald: "Oswald, 'Arial Narrow', Arial, sans-serif",
  raleway: "Raleway, 'Segoe UI', Helvetica, Arial, sans-serif",
  nunito: "Nunito, 'Segoe UI', Helvetica, Arial, sans-serif",
  playfair_display: "Playfair Display, Georgia, 'Times New Roman', serif",
  merriweather: "Merriweather, Georgia, 'Times New Roman', serif",
  lora: "Lora, Georgia, 'Times New Roman', serif",
  source_sans_3: "Source Sans 3, 'Segoe UI', Helvetica, Arial, sans-serif",
  dm_sans: "DM Sans, 'Segoe UI', Helvetica, Arial, sans-serif",
  rubik: "Rubik, 'Segoe UI', Helvetica, Arial, sans-serif",
  manrope: "Manrope, 'Segoe UI', Helvetica, Arial, sans-serif",
  work_sans: "'Work Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  fira_sans: "'Fira Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  pt_sans: "'PT Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  karla: "Karla, 'Segoe UI', Helvetica, Arial, sans-serif",
  jost: "Jost, 'Segoe UI', Helvetica, Arial, sans-serif",
  barlow: "Barlow, 'Segoe UI', Helvetica, Arial, sans-serif",
  quicksand: "Quicksand, 'Segoe UI', Helvetica, Arial, sans-serif",
  bebas_neue: "'Bebas Neue', 'Arial Narrow', Arial, sans-serif",
  space_grotesk: "'Space Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif",
  ubuntu: "Ubuntu, 'Segoe UI', Helvetica, Arial, sans-serif",
  josefin_sans: "'Josefin Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  libre_baskerville: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
  libre_franklin: "'Libre Franklin', 'Segoe UI', Helvetica, Arial, sans-serif",
  mukta: "Mukta, 'Segoe UI', Helvetica, Arial, sans-serif",
  oxygen: "Oxygen, 'Segoe UI', Helvetica, Arial, sans-serif",
  exo_2: "'Exo 2', 'Segoe UI', Helvetica, Arial, sans-serif",
  inconsolata: "Inconsolata, 'Courier New', Courier, monospace",
  merriweather_sans: "'Merriweather Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  teko: "Teko, 'Arial Narrow', Arial, sans-serif",
  anton: "Anton, 'Arial Narrow', Arial, sans-serif",
  archivo: "Archivo, 'Segoe UI', Helvetica, Arial, sans-serif",
  assistant: "Assistant, 'Segoe UI', Helvetica, Arial, sans-serif",
  asap: "Asap, 'Segoe UI', Helvetica, Arial, sans-serif",
  barlow_condensed: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
  figtree: "Figtree, 'Segoe UI', Helvetica, Arial, sans-serif",
  public_sans: "'Public Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  red_hat_display: "'Red Hat Display', 'Segoe UI', Helvetica, Arial, sans-serif",
  red_hat_text: "'Red Hat Text', 'Segoe UI', Helvetica, Arial, sans-serif",
  sora: "Sora, 'Segoe UI', Helvetica, Arial, sans-serif",
  plus_jakarta_sans: "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif",
  epilogue: "Epilogue, 'Segoe UI', Helvetica, Arial, sans-serif",
  lexend: "Lexend, 'Segoe UI', Helvetica, Arial, sans-serif",
  inter_tight: "'Inter Tight', 'Segoe UI', Helvetica, Arial, sans-serif",
  fraunces: "Fraunces, Georgia, 'Times New Roman', serif",
  cormorant_garamond: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  crimson_pro: "'Crimson Pro', Georgia, 'Times New Roman', serif",
  cabin: "Cabin, 'Segoe UI', Helvetica, Arial, sans-serif",
  titillium_web: "'Titillium Web', 'Segoe UI', Helvetica, Arial, sans-serif",
  hind: "Hind, 'Segoe UI', Helvetica, Arial, sans-serif",
  prompt: "Prompt, 'Segoe UI', Helvetica, Arial, sans-serif",
  arimo: "Arimo, 'Segoe UI', Helvetica, Arial, sans-serif",
  heebo: "Heebo, 'Segoe UI', Helvetica, Arial, sans-serif",
  kanit: "Kanit, 'Segoe UI', Helvetica, Arial, sans-serif",
  dosis: "Dosis, 'Segoe UI', Helvetica, Arial, sans-serif",
};

const FONTSOURCE_FONT_MAP: Partial<Record<TemplateFontFamily, FontSourceDescriptor>> = {
  inter: { packageName: '@fontsource/inter', familyName: 'Inter' },
  roboto: { packageName: '@fontsource/roboto', familyName: 'Roboto' },
  open_sans: { packageName: '@fontsource/open-sans', familyName: 'Open Sans' },
  poppins: { packageName: '@fontsource/poppins', familyName: 'Poppins' },
  montserrat: { packageName: '@fontsource/montserrat', familyName: 'Montserrat' },
  lato: { packageName: '@fontsource/lato', familyName: 'Lato' },
  oswald: { packageName: '@fontsource/oswald', familyName: 'Oswald' },
  raleway: { packageName: '@fontsource/raleway', familyName: 'Raleway' },
  nunito: { packageName: '@fontsource/nunito', familyName: 'Nunito' },
  playfair_display: { packageName: '@fontsource/playfair-display', familyName: 'Playfair Display' },
  merriweather: { packageName: '@fontsource/merriweather', familyName: 'Merriweather' },
  lora: { packageName: '@fontsource/lora', familyName: 'Lora' },
  source_sans_3: { packageName: '@fontsource/source-sans-3', familyName: 'Source Sans 3' },
  dm_sans: { packageName: '@fontsource/dm-sans', familyName: 'DM Sans' },
  rubik: { packageName: '@fontsource/rubik', familyName: 'Rubik' },
  manrope: { packageName: '@fontsource/manrope', familyName: 'Manrope' },
  work_sans: { packageName: '@fontsource/work-sans', familyName: 'Work Sans' },
  fira_sans: { packageName: '@fontsource/fira-sans', familyName: 'Fira Sans' },
  pt_sans: { packageName: '@fontsource/pt-sans', familyName: 'PT Sans' },
  karla: { packageName: '@fontsource/karla', familyName: 'Karla' },
  jost: { packageName: '@fontsource/jost', familyName: 'Jost' },
  barlow: { packageName: '@fontsource/barlow', familyName: 'Barlow' },
  quicksand: { packageName: '@fontsource/quicksand', familyName: 'Quicksand' },
  bebas_neue: { packageName: '@fontsource/bebas-neue', familyName: 'Bebas Neue' },
  space_grotesk: { packageName: '@fontsource/space-grotesk', familyName: 'Space Grotesk' },
  ubuntu: { packageName: '@fontsource/ubuntu', familyName: 'Ubuntu' },
  josefin_sans: { packageName: '@fontsource/josefin-sans', familyName: 'Josefin Sans' },
  libre_baskerville: { packageName: '@fontsource/libre-baskerville', familyName: 'Libre Baskerville' },
  libre_franklin: { packageName: '@fontsource/libre-franklin', familyName: 'Libre Franklin' },
  mukta: { packageName: '@fontsource/mukta', familyName: 'Mukta' },
  oxygen: { packageName: '@fontsource/oxygen', familyName: 'Oxygen' },
  exo_2: { packageName: '@fontsource/exo-2', familyName: 'Exo 2' },
  inconsolata: { packageName: '@fontsource/inconsolata', familyName: 'Inconsolata' },
  merriweather_sans: { packageName: '@fontsource/merriweather-sans', familyName: 'Merriweather Sans' },
  teko: { packageName: '@fontsource/teko', familyName: 'Teko' },
  anton: { packageName: '@fontsource/anton', familyName: 'Anton' },
  archivo: { packageName: '@fontsource/archivo', familyName: 'Archivo' },
  assistant: { packageName: '@fontsource/assistant', familyName: 'Assistant' },
  asap: { packageName: '@fontsource/asap', familyName: 'Asap' },
  barlow_condensed: { packageName: '@fontsource/barlow-condensed', familyName: 'Barlow Condensed' },
  figtree: { packageName: '@fontsource/figtree', familyName: 'Figtree' },
  public_sans: { packageName: '@fontsource/public-sans', familyName: 'Public Sans' },
  red_hat_display: { packageName: '@fontsource/red-hat-display', familyName: 'Red Hat Display' },
  red_hat_text: { packageName: '@fontsource/red-hat-text', familyName: 'Red Hat Text' },
  sora: { packageName: '@fontsource/sora', familyName: 'Sora' },
  plus_jakarta_sans: { packageName: '@fontsource/plus-jakarta-sans', familyName: 'Plus Jakarta Sans' },
  epilogue: { packageName: '@fontsource/epilogue', familyName: 'Epilogue' },
  lexend: { packageName: '@fontsource/lexend', familyName: 'Lexend' },
  inter_tight: { packageName: '@fontsource/inter-tight', familyName: 'Inter Tight' },
  fraunces: { packageName: '@fontsource/fraunces', familyName: 'Fraunces' },
  cormorant_garamond: { packageName: '@fontsource/cormorant-garamond', familyName: 'Cormorant Garamond' },
  crimson_pro: { packageName: '@fontsource/crimson-pro', familyName: 'Crimson Pro' },
  cabin: { packageName: '@fontsource/cabin', familyName: 'Cabin' },
  titillium_web: { packageName: '@fontsource/titillium-web', familyName: 'Titillium Web' },
  hind: { packageName: '@fontsource/hind', familyName: 'Hind' },
  prompt: { packageName: '@fontsource/prompt', familyName: 'Prompt' },
  arimo: { packageName: '@fontsource/arimo', familyName: 'Arimo' },
  heebo: { packageName: '@fontsource/heebo', familyName: 'Heebo' },
  kanit: { packageName: '@fontsource/kanit', familyName: 'Kanit' },
  dosis: { packageName: '@fontsource/dosis', familyName: 'Dosis' },
};

const FONTSOURCE_PACKAGE_JSON_PATHS: Partial<Record<TemplateFontFamily, string>> = {
  inter: require.resolve('@fontsource/inter/package.json'),
  roboto: require.resolve('@fontsource/roboto/package.json'),
  open_sans: require.resolve('@fontsource/open-sans/package.json'),
  poppins: require.resolve('@fontsource/poppins/package.json'),
  montserrat: require.resolve('@fontsource/montserrat/package.json'),
  lato: require.resolve('@fontsource/lato/package.json'),
  oswald: require.resolve('@fontsource/oswald/package.json'),
  raleway: require.resolve('@fontsource/raleway/package.json'),
  nunito: require.resolve('@fontsource/nunito/package.json'),
  playfair_display: require.resolve('@fontsource/playfair-display/package.json'),
  merriweather: require.resolve('@fontsource/merriweather/package.json'),
  lora: require.resolve('@fontsource/lora/package.json'),
  source_sans_3: require.resolve('@fontsource/source-sans-3/package.json'),
  dm_sans: require.resolve('@fontsource/dm-sans/package.json'),
  rubik: require.resolve('@fontsource/rubik/package.json'),
  manrope: require.resolve('@fontsource/manrope/package.json'),
  work_sans: require.resolve('@fontsource/work-sans/package.json'),
  fira_sans: require.resolve('@fontsource/fira-sans/package.json'),
  pt_sans: require.resolve('@fontsource/pt-sans/package.json'),
  karla: require.resolve('@fontsource/karla/package.json'),
  jost: require.resolve('@fontsource/jost/package.json'),
  barlow: require.resolve('@fontsource/barlow/package.json'),
  quicksand: require.resolve('@fontsource/quicksand/package.json'),
  bebas_neue: require.resolve('@fontsource/bebas-neue/package.json'),
  space_grotesk: require.resolve('@fontsource/space-grotesk/package.json'),
  ubuntu: require.resolve('@fontsource/ubuntu/package.json'),
  josefin_sans: require.resolve('@fontsource/josefin-sans/package.json'),
  libre_baskerville: require.resolve('@fontsource/libre-baskerville/package.json'),
  libre_franklin: require.resolve('@fontsource/libre-franklin/package.json'),
  mukta: require.resolve('@fontsource/mukta/package.json'),
  oxygen: require.resolve('@fontsource/oxygen/package.json'),
  exo_2: require.resolve('@fontsource/exo-2/package.json'),
  inconsolata: require.resolve('@fontsource/inconsolata/package.json'),
  merriweather_sans: require.resolve('@fontsource/merriweather-sans/package.json'),
  teko: require.resolve('@fontsource/teko/package.json'),
  anton: require.resolve('@fontsource/anton/package.json'),
  archivo: require.resolve('@fontsource/archivo/package.json'),
  assistant: require.resolve('@fontsource/assistant/package.json'),
  asap: require.resolve('@fontsource/asap/package.json'),
  barlow_condensed: require.resolve('@fontsource/barlow-condensed/package.json'),
  figtree: require.resolve('@fontsource/figtree/package.json'),
  public_sans: require.resolve('@fontsource/public-sans/package.json'),
  red_hat_display: require.resolve('@fontsource/red-hat-display/package.json'),
  red_hat_text: require.resolve('@fontsource/red-hat-text/package.json'),
  sora: require.resolve('@fontsource/sora/package.json'),
  plus_jakarta_sans: require.resolve('@fontsource/plus-jakarta-sans/package.json'),
  epilogue: require.resolve('@fontsource/epilogue/package.json'),
  lexend: require.resolve('@fontsource/lexend/package.json'),
  inter_tight: require.resolve('@fontsource/inter-tight/package.json'),
  fraunces: require.resolve('@fontsource/fraunces/package.json'),
  cormorant_garamond: require.resolve('@fontsource/cormorant-garamond/package.json'),
  crimson_pro: require.resolve('@fontsource/crimson-pro/package.json'),
  cabin: require.resolve('@fontsource/cabin/package.json'),
  titillium_web: require.resolve('@fontsource/titillium-web/package.json'),
  hind: require.resolve('@fontsource/hind/package.json'),
  prompt: require.resolve('@fontsource/prompt/package.json'),
  arimo: require.resolve('@fontsource/arimo/package.json'),
  heebo: require.resolve('@fontsource/heebo/package.json'),
  kanit: require.resolve('@fontsource/kanit/package.json'),
  dosis: require.resolve('@fontsource/dosis/package.json'),
};

const FONT_FACE_CSS_CACHE = new Map<TemplateFontFamily, string>();

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
    const baseStyle = this.styles.get(options.style);
    if (!baseStyle) {
      throw new Error(`Unknown style: ${options.style}`);
    }
    const style = options.background
      ? this.withAutoTextColor(baseStyle, options.background)
      : baseStyle;
    const textRenderStyle = this.resolveTextStyle(style, options.textStyle);

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

    if (options.background) {
      background = await this.createBackgroundFromSelection(
        dimensions.width,
        dimensions.height,
        options.background
      );
    } else if (options.style === 'modern' || options.style === 'gradient') {
      // Create default gradient background
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

    const layerResult =
      frameMode === 'none'
        ? await this.createNoFrameLayers(options, screenshotMeta, visualRegion)
        : await this.createFramedLayers(options, screenshotMeta, visualRegion);

    const textSVG = this.createTextSVG(
      options.title,
      options.subtitle ?? '',
      dimensions.width,
      dimensions.height,
      textRenderStyle,
      layerResult.contentBottom
    );

    const canvas = background.composite([
      ...layerResult.layers,
      { input: Buffer.from(textSVG), top: 0, left: 0 },
    ]);

    // Export as PNG
    return canvas.png().toBuffer();
  }

  private getVisualRegion(
    canvasWidth: number,
    canvasHeight: number,
    style: StyleConfig
  ): VisualRegion {
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
    screenshotMeta: sharp.Metadata,
    visualRegion: VisualRegion
  ): Promise<LayerResult> {
    const frameMode = options.frameMode ?? 'minimal';

    if (frameMode === 'realistic') {
      const realisticLayers = await this.createRealisticFrameLayers(
        options,
        screenshotMeta,
        visualRegion
      );
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
          input: Buffer.from(
            this.createMinimalFrameOverlaySVG(frame.width, frame.height, preset, screen)
          ),
          left: frameLeft,
          top: frameTop,
        },
      ],
      contentBottom: frameTop + frame.height,
    };
  }

  private async createRealisticFrameLayers(
    options: CompositeOptions,
    screenshotMeta: sharp.Metadata,
    visualRegion: VisualRegion
  ): Promise<LayerResult | null> {
    const targetScreenAspect =
      screenshotMeta.width && screenshotMeta.height
        ? screenshotMeta.width / screenshotMeta.height
        : undefined;
    const frameAsset = await this.loadRealisticFrameAsset(
      options.deviceType,
      options.frameAssetsDir,
      targetScreenAspect,
      options.realisticFrameFile
    );
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
    assetsDir?: string,
    targetScreenAspect?: number,
    preferredFileName?: string
  ): Promise<RealisticFrameAsset | null> {
    return resolveRealisticFrameAsset({
      deviceType,
      assetsDir,
      targetScreenAspect,
      preferredFileName,
    });
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
    const cornerRadius = Math.round(
      Math.min(frameWidth, frameHeight) * preset.outerCornerRadiusRatio
    );

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
    const outerRadius = Math.round(
      Math.min(frameWidth, frameHeight) * preset.outerCornerRadiusRatio
    );
    const outerStrokeWidth = Math.max(2, Math.round(frameWidth * 0.004));
    const screenStrokeWidth = Math.max(2, Math.round(frameWidth * 0.0025));

    const speakerAccent =
      preset.topAccent === 'speaker'
        ? `<rect x="${Math.round(frameWidth * 0.35)}" y="${Math.round(frameHeight * 0.012)}" width="${Math.round(frameWidth * 0.3)}" height="${Math.max(8, Math.round(frameHeight * 0.01))}" rx="${Math.round(frameWidth * 0.02)}" fill="#0A0D12" opacity="0.85" />`
        : '';

    const punchHole =
      preset.topAccent === 'punch-hole'
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
   * Create background from user-selected values
   */
  private async createBackgroundFromSelection(
    width: number,
    height: number,
    background: TemplateBackground
  ): Promise<sharp.Sharp> {
    if (background.mode === 'solid') {
      return sharp({
        create: {
          width,
          height,
          channels: 3,
          background: background.color,
        },
      });
    }

    return sharp(
      Buffer.from(
        this.createCustomGradient(width, height, background.from, background.to, background.angle)
      )
    );
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
    const gradientSVG =
      style === 'modern'
        ? this.createModernGradient(width, height)
        : this.createBoldGradient(width, height);

    return sharp(Buffer.from(gradientSVG));
  }

  private createCustomGradient(
    width: number,
    height: number,
    fromColor: string,
    toColor: string,
    angle = 135
  ): string {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const radians = (normalizedAngle * Math.PI) / 180;
    const dx = Math.cos(radians) * 50;
    const dy = Math.sin(radians) * 50;
    const x1 = 50 - dx;
    const y1 = 50 + dy;
    const x2 = 50 + dx;
    const y2 = 50 - dy;

    return `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="userGrad" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
            <stop offset="0%" style="stop-color:${fromColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${toColor};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#userGrad)" />
      </svg>
    `;
  }

  private withAutoTextColor(style: StyleConfig, background: TemplateBackground): StyleConfig {
    const textColor = this.getContrastingTextColor(background);
    return { ...style, textColor };
  }

  private resolveTextStyle(style: StyleConfig, textStyle?: TemplateTextStyle): TextRenderStyle {
    const resolvedTitleSize = textStyle?.fontSize
      ? Math.max(16, Math.round(textStyle.fontSize))
      : style.titleSize;
    const resolvedSubtitleSize = textStyle?.fontSize
      ? Math.max(12, Math.round(textStyle.fontSize * 0.55))
      : style.subtitleSize;
    const fontFamilyKey = textStyle?.fontFamily ?? 'system';

    return {
      ...style,
      titleSize: resolvedTitleSize,
      subtitleSize: resolvedSubtitleSize,
      textColor: textStyle?.fontColor || style.textColor,
      fontFamily: FONT_FAMILY_STACKS[fontFamilyKey],
      fontFaceCSS: this.getFontFaceCSS(fontFamilyKey),
    };
  }

  private getFontFaceCSS(fontFamilyKey: TemplateFontFamily): string {
    const cached = FONT_FACE_CSS_CACHE.get(fontFamilyKey);
    if (cached !== undefined) {
      return cached;
    }

    const descriptor = FONTSOURCE_FONT_MAP[fontFamilyKey];
    const packageJsonPath = FONTSOURCE_PACKAGE_JSON_PATHS[fontFamilyKey];

    if (!descriptor || !packageJsonPath) {
      FONT_FACE_CSS_CACHE.set(fontFamilyKey, '');
      return '';
    }

    try {
      const filesDir = join(dirname(packageJsonPath), 'files');
      const files = readdirSync(filesDir);

      const file400 = this.resolveFontFile(files, descriptor.packageName, 400);
      const file700 = this.resolveFontFile(files, descriptor.packageName, 700) || file400;

      if (!file400) {
        FONT_FACE_CSS_CACHE.set(fontFamilyKey, '');
        return '';
      }

      const rules = [
        this.buildFontFaceRule(join(filesDir, file400), descriptor.familyName, 400),
        file700 ? this.buildFontFaceRule(join(filesDir, file700), descriptor.familyName, 700) : '',
      ]
        .filter(Boolean)
        .join('\n');

      FONT_FACE_CSS_CACHE.set(fontFamilyKey, rules);
      return rules;
    } catch {
      FONT_FACE_CSS_CACHE.set(fontFamilyKey, '');
      return '';
    }
  }

  private resolveFontFile(
    files: string[],
    packageName: string,
    weight: FontWeight
  ): string | null {
    const familyToken = packageName.split('/').pop() || '';
    const patterns = [
      `${familyToken}-latin-${weight}-normal`,
      `latin-${weight}-normal`,
      `${weight}-normal`,
      `${familyToken}-latin-wght-normal`,
      'latin-wght-normal',
      'wght-normal',
    ];

    for (const pattern of patterns) {
      const exactWoff2 = `${pattern}.woff2`;
      if (files.includes(exactWoff2)) {
        return exactWoff2;
      }
      const exactWoff = `${pattern}.woff`;
      if (files.includes(exactWoff)) {
        return exactWoff;
      }

      const partialWoff2 = files.find((file) => file.endsWith('.woff2') && file.includes(pattern));
      if (partialWoff2) {
        return partialWoff2;
      }
      const partialWoff = files.find((file) => file.endsWith('.woff') && file.includes(pattern));
      if (partialWoff) {
        return partialWoff;
      }
    }

    return (
      files.find((file) => file.endsWith('.woff2') && file.includes('400-normal')) ||
      files.find((file) => file.endsWith('.woff') && file.includes('400-normal')) ||
      null
    );
  }

  private buildFontFaceRule(filePath: string, familyName: string, weight: FontWeight): string {
    const fileBuffer = readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const isWoff2 = filePath.endsWith('.woff2');
    const mimeType = isWoff2 ? 'font/woff2' : 'font/woff';
    const format = isWoff2 ? 'woff2' : 'woff';

    return `@font-face { font-family: '${this.escapeCSSString(familyName)}'; src: url(data:${mimeType};base64,${base64}) format('${format}'); font-style: normal; font-weight: ${weight}; font-display: swap; }`;
  }

  private getContrastingTextColor(background: TemplateBackground): string {
    if (background.mode === 'solid') {
      const rgb = this.parseHexColor(background.color);
      return this.isLightColor(rgb) ? '#111111' : '#FFFFFF';
    }

    const start = this.parseHexColor(background.from);
    const end = this.parseHexColor(background.to);
    const average = {
      r: Math.round((start.r + end.r) / 2),
      g: Math.round((start.g + end.g) / 2),
      b: Math.round((start.b + end.b) / 2),
    };
    return this.isLightColor(average) ? '#111111' : '#FFFFFF';
  }

  private parseHexColor(value: string): { r: number; g: number; b: number } {
    const hex = value.replace('#', '').trim();
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  private isLightColor(color: { r: number; g: number; b: number }): boolean {
    const relativeLuminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
    return relativeLuminance > 0.62;
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
    style: TextRenderStyle,
    contentBottom: number
  ): string {
    const titleSubtitleGap = Math.max(10, Math.round(style.titleSize * 0.28));
    const subtitleLineGap = Math.max(8, Math.round(style.subtitleSize * 0.42));
    const maxCharsPerLine = Math.max(18, Math.round((50 * 24) / style.subtitleSize));
    const subtitleLines = this.wrapText(subtitle, maxCharsPerLine);
    const subtitleBlockHeight =
      subtitleLines.length > 0
        ? style.subtitleSize + (subtitleLines.length - 1) * (style.subtitleSize + subtitleLineGap)
        : 0;

    const topTitleY = style.textPadding + style.titleSize;
    const bottomTitleTarget = contentBottom + style.textPadding + style.titleSize;
    const bottomSafeLimit =
      canvasHeight - style.textPadding - subtitleBlockHeight - titleSubtitleGap;
    const titleY =
      style.textPosition === 'top' ? topTitleY : Math.min(bottomTitleTarget, bottomSafeLimit);
    const subtitleY = titleY + style.titleSize + titleSubtitleGap;

    return `
      <svg width="${canvasWidth}" height="${canvasHeight}">
        <style>
          ${style.fontFaceCSS}
          .title {
            font-family: ${style.fontFamily};
            font-size: ${style.titleSize}px;
            font-weight: 700;
            fill: ${style.textColor};
            text-anchor: middle;
          }
          .subtitle {
            font-family: ${style.fontFamily};
            font-size: ${style.subtitleSize}px;
            font-weight: 400;
            fill: ${style.textColor};
            text-anchor: middle;
            opacity: 0.9;
          }
        </style>
        <text x="${canvasWidth / 2}" y="${titleY}" class="title">${this.escapeXML(title)}</text>
        ${subtitleLines
          .map(
            (line, i) =>
              `<text x="${canvasWidth / 2}" y="${subtitleY + i * (style.subtitleSize + subtitleLineGap)}" class="subtitle">${this.escapeXML(line)}</text>`
          )
          .join('')}
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

  private escapeCSSString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  /**
   * Get list of available template styles
   */
  getAvailableStyles(): TemplateStyle[] {
    return Array.from(this.styles.keys());
  }
}
