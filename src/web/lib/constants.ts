/**
 * Constants for device types, locales, templates, and other configuration
 */

import type { DeviceType, TemplateStyle, FrameMode } from '../types';
import type { TemplateDeviceType } from '../../types';

/**
 * Device types available in the system
 */
export const DEVICE_TYPES: DeviceType[] = ['iPhone', 'iPad', 'Android-phone', 'Android-tablet'];

/**
 * Map web device types to template engine device types
 */
export const DEVICE_TYPE_TO_TEMPLATE: Record<DeviceType, TemplateDeviceType> = {
  iPhone: 'iPhone',
  iPad: 'iPad',
  'Android-phone': 'Android',
  'Android-tablet': 'Android',
};

/**
 * Device type labels for UI
 */
export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  iPhone: 'iPhone',
  iPad: 'iPad',
  'Android-phone': 'Android Phone',
  'Android-tablet': 'Android Tablet',
};

/**
 * Template styles available
 */
export const TEMPLATE_STYLES: TemplateStyle[] = [
  'minimal',
  'modern',
  'gradient',
  'dark',
  'playful',
];

/**
 * Template style descriptions
 */
export const TEMPLATE_STYLE_INFO: Record<TemplateStyle, { name: string; description: string }> = {
  minimal: {
    name: 'Minimal',
    description: 'White background, thin frame, text below',
  },
  modern: {
    name: 'Modern',
    description: 'Gradient background, floating device with shadow',
  },
  gradient: {
    name: 'Gradient',
    description: 'Bold gradient, angled device, large text overlay',
  },
  dark: {
    name: 'Dark',
    description: 'Dark background, glowing edges, light text',
  },
  playful: {
    name: 'Playful',
    description: 'Colorful shapes, rotated device, fun fonts',
  },
};

/**
 * Frame modes available
 */
export const FRAME_MODES: Array<{
  value: FrameMode;
  label: string;
  description: string;
}> = [
  {
    value: 'none',
    label: 'No Frame',
    description: 'Screenshot only, no device bezel',
  },
  {
    value: 'minimal',
    label: 'Minimal Frame',
    description: 'Simple procedural device outline',
  },
  {
    value: 'realistic',
    label: 'Realistic Frame',
    description: 'Photorealistic device frame',
  },
];

/**
 * Supported locales (App Store Connect locales)
 */
export const SUPPORTED_LOCALES: Array<{ code: string; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'en-AU', name: 'English (Australia)' },
  { code: 'en-CA', name: 'English (Canada)' },
  { code: 'de', name: 'German' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'es', name: 'Spanish' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr', name: 'French' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'fr-CA', name: 'French (Canada)' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)' },
  { code: 'zh-CN', name: 'Chinese (China)' },
  { code: 'zh-TW', name: 'Chinese (Taiwan)' },
  { code: 'zh-HK', name: 'Chinese (Hong Kong)' },
  { code: 'ru', name: 'Russian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'hi', name: 'Hindi' },
];

/**
 * Default locale
 */
export const DEFAULT_LOCALE = 'en';

/**
 * Maximum file size for uploads (10MB)
 */
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/**
 * App Store screenshot character limits
 */
export const CHARACTER_LIMITS = {
  title: 30,
  subtitle: 80,
  appName: 100,
  appDescription: 500,
};
