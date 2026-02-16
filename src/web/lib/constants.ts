/**
 * Constants for device types, locales, templates, and other configuration
 */

import type { DeviceType, TemplateStyle, FrameMode, TemplateFontFamily } from '../types';
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
 * Template text font options
 */
export const TEMPLATE_FONT_OPTIONS: Array<{ value: TemplateFontFamily; label: string }> = [
  { value: 'system', label: 'System UI' },
  { value: 'helvetica', label: 'Helvetica' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'avenir', label: 'Avenir' },
  { value: 'courier', label: 'Courier New' },
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open_sans', label: 'Open Sans' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'lato', label: 'Lato' },
  { value: 'oswald', label: 'Oswald' },
  { value: 'raleway', label: 'Raleway' },
  { value: 'nunito', label: 'Nunito' },
  { value: 'playfair_display', label: 'Playfair Display' },
  { value: 'merriweather', label: 'Merriweather' },
  { value: 'lora', label: 'Lora' },
  { value: 'source_sans_3', label: 'Source Sans 3' },
  { value: 'dm_sans', label: 'DM Sans' },
  { value: 'rubik', label: 'Rubik' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'work_sans', label: 'Work Sans' },
  { value: 'fira_sans', label: 'Fira Sans' },
  { value: 'pt_sans', label: 'PT Sans' },
  { value: 'karla', label: 'Karla' },
  { value: 'jost', label: 'Jost' },
  { value: 'barlow', label: 'Barlow' },
  { value: 'quicksand', label: 'Quicksand' },
  { value: 'bebas_neue', label: 'Bebas Neue' },
  { value: 'space_grotesk', label: 'Space Grotesk' },
  { value: 'ubuntu', label: 'Ubuntu' },
  { value: 'josefin_sans', label: 'Josefin Sans' },
  { value: 'libre_baskerville', label: 'Libre Baskerville' },
  { value: 'libre_franklin', label: 'Libre Franklin' },
  { value: 'mukta', label: 'Mukta' },
  { value: 'oxygen', label: 'Oxygen' },
  { value: 'exo_2', label: 'Exo 2' },
  { value: 'inconsolata', label: 'Inconsolata' },
  { value: 'merriweather_sans', label: 'Merriweather Sans' },
  { value: 'teko', label: 'Teko' },
  { value: 'anton', label: 'Anton' },
  { value: 'archivo', label: 'Archivo' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'asap', label: 'Asap' },
  { value: 'barlow_condensed', label: 'Barlow Condensed' },
  { value: 'figtree', label: 'Figtree' },
  { value: 'public_sans', label: 'Public Sans' },
  { value: 'red_hat_display', label: 'Red Hat Display' },
  { value: 'red_hat_text', label: 'Red Hat Text' },
  { value: 'sora', label: 'Sora' },
  { value: 'plus_jakarta_sans', label: 'Plus Jakarta Sans' },
  { value: 'epilogue', label: 'Epilogue' },
  { value: 'lexend', label: 'Lexend' },
  { value: 'inter_tight', label: 'Inter Tight' },
  { value: 'fraunces', label: 'Fraunces' },
  { value: 'cormorant_garamond', label: 'Cormorant Garamond' },
  { value: 'crimson_pro', label: 'Crimson Pro' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'titillium_web', label: 'Titillium Web' },
  { value: 'hind', label: 'Hind' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'arimo', label: 'Arimo' },
  { value: 'heebo', label: 'Heebo' },
  { value: 'kanit', label: 'Kanit' },
  { value: 'dosis', label: 'Dosis' },
];

/**
 * Template text size limits (pixels)
 */
export const TEMPLATE_FONT_SIZE_LIMITS = {
  min: 24,
  max: 80,
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
  appName: 100,
  appDescription: 500,
};
