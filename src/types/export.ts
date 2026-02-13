/**
 * Export types for template application and screenshot export (US-017, US-019)
 */

/**
 * Template style names
 */
export type TemplateStyleName = 'minimal' | 'modern' | 'gradient' | 'dark' | 'playful';

/**
 * Device target for export
 */
export type DeviceTarget = 'iphone' | 'ipad';

/**
 * Export size configuration
 */
export interface ExportSize {
  /** Device target */
  device: DeviceTarget;
  /** Display name (e.g., "iPhone 6.5\"") */
  displayName: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Standard App Store export sizes (US-019)
 */
export const EXPORT_SIZES: Record<DeviceTarget, ExportSize> = {
  iphone: {
    device: 'iphone',
    displayName: 'iPhone 6.5"',
    width: 1242,
    height: 2688,
  },
  ipad: {
    device: 'ipad',
    displayName: 'iPad 13"',
    width: 2048,
    height: 2732,
  },
};

/**
 * Text overlay configuration in template
 */
export interface TextOverlay {
  /** Text content (supports {{locale_key}} placeholders) */
  content: string;
  /** Position from top (% of canvas height) */
  top: number;
  /** Font family */
  fontFamily: string;
  /** Font size in pixels */
  fontSize: number;
  /** Text color (hex) */
  color: string;
  /** Text alignment */
  align: 'left' | 'center' | 'right';
  /** Maximum width (% of canvas width) */
  maxWidth: number;
  /** Bold weight */
  bold?: boolean;
}

/**
 * Background layer configuration
 */
export interface BackgroundLayer {
  /** Background type */
  type: 'solid' | 'gradient' | 'image';
  /** Solid color (hex) */
  color?: string;
  /** Gradient colors (for type='gradient') */
  gradientColors?: [string, string];
  /** Gradient angle in degrees */
  gradientAngle?: number;
  /** Image path (for type='image') */
  imagePath?: string;
}

/**
 * Device frame configuration
 */
export interface DeviceFrame {
  /** Device frame SVG file name */
  fileName: string;
  /** Device display area bounds within frame (percentage) */
  displayArea: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/**
 * Complete template style definition
 */
export interface TemplateStyleDefinition {
  /** Style name */
  name: TemplateStyleName;
  /** Display name */
  displayName: string;
  /** Background layer */
  background: BackgroundLayer;
  /** Device frame configuration */
  deviceFrame: DeviceFrame;
  /** Text overlays (title, subtitle, etc.) */
  textOverlays: TextOverlay[];
  /** Safe area padding (percentage) */
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Export configuration for a single screenshot
 */
export interface ScreenshotExportConfig {
  /** Path to raw screenshot PNG */
  screenshotPath: string;
  /** Screenshot label/name */
  label: string;
  /** Locale for this export */
  locale: string;
  /** Template style to apply */
  style: TemplateStyleDefinition;
  /** Target export size */
  targetSize: ExportSize;
  /** Localized text content for overlays */
  translations: Record<string, string>;
}

/**
 * Batch export configuration
 */
export interface ExportConfig {
  /** Template name being exported */
  templateName: string;
  /** Output directory */
  outputDir: string;
  /** Template style name */
  styleName: TemplateStyleName;
  /** Target locales */
  locales: string[];
  /** Device targets */
  devices: DeviceTarget[];
}

/**
 * Export result for a single screenshot
 */
export interface ScreenshotExportResult {
  /** Locale */
  locale: string;
  /** Device target */
  device: DeviceTarget;
  /** Screenshot label */
  label: string;
  /** Output file path */
  outputPath: string;
  /** File size in bytes */
  fileSize: number;
  /** Whether export succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Complete export result
 */
export interface ExportResult {
  /** Template name */
  templateName: string;
  /** Style used */
  styleName: TemplateStyleName;
  /** Per-screenshot results */
  screenshots: ScreenshotExportResult[];
  /** Total successful exports */
  successCount: number;
  /** Total failed exports */
  failureCount: number;
  /** Total duration in milliseconds */
  duration: number;
}
