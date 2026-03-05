/**
 * Database model types for the Aperture web GUI
 */

/**
 * Device types supported by the system
 */
export type DeviceType = 'iPhone' | 'iPad' | 'Android-phone' | 'Android-tablet';

/**
 * Generation status
 */
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Template styles available
 */
export type TemplateStyle = 'minimal' | 'modern' | 'gradient' | 'dark' | 'playful';
export type TemplateBackground =
  | { mode: 'solid'; color: string }
  | { mode: 'gradient'; from: string; to: string; angle?: number }
  | { mode: 'image'; image_path: string }
  | { mode: 'transparent' };
export type TemplateFontFamily =
  | 'system'
  | 'helvetica'
  | 'georgia'
  | 'avenir'
  | 'courier'
  | 'inter'
  | 'roboto'
  | 'open_sans'
  | 'poppins'
  | 'montserrat'
  | 'lato'
  | 'oswald'
  | 'raleway'
  | 'nunito'
  | 'playfair_display'
  | 'merriweather'
  | 'lora'
  | 'source_sans_3'
  | 'dm_sans'
  | 'rubik'
  | 'manrope'
  | 'work_sans'
  | 'fira_sans'
  | 'pt_sans'
  | 'karla'
  | 'jost'
  | 'barlow'
  | 'quicksand'
  | 'bebas_neue'
  | 'space_grotesk'
  | 'ubuntu'
  | 'josefin_sans'
  | 'libre_baskerville'
  | 'libre_franklin'
  | 'mukta'
  | 'oxygen'
  | 'exo_2'
  | 'inconsolata'
  | 'merriweather_sans'
  | 'teko'
  | 'anton'
  | 'archivo'
  | 'assistant'
  | 'asap'
  | 'barlow_condensed'
  | 'figtree'
  | 'public_sans'
  | 'red_hat_display'
  | 'red_hat_text'
  | 'sora'
  | 'plus_jakarta_sans'
  | 'epilogue'
  | 'lexend'
  | 'inter_tight'
  | 'fraunces'
  | 'cormorant_garamond'
  | 'crimson_pro'
  | 'cabin'
  | 'titillium_web'
  | 'hind'
  | 'prompt'
  | 'arimo'
  | 'heebo'
  | 'kanit'
  | 'dosis';
export interface TemplateTextStyle {
  font_family?: TemplateFontFamily;
  font_size?: number;
  subtitle_size?: number;
  font_color?: string;
}

/**
 * Frame modes for device rendering
 */
export type FrameMode = 'none' | 'minimal' | 'realistic';

/**
 * Optional frame mode overrides per device type
 */
export type FrameModesByDevice = Partial<Record<DeviceType, FrameMode>>;
export type FrameAssetFilesByDevice = Partial<Record<DeviceType, string>>;

/**
 * App entity
 */
export interface App {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * Device-specific screenshot variant for a screen
 */
export interface ScreenVariant {
  id: number;
  screen_id: number;
  device_type: DeviceType;
  screenshot_path: string;
  created_at: string;
}

/**
 * Localized screenshot variant for a screen + locale + device
 */
export interface ScreenLocalizedVariant {
  id: number;
  screen_id: number;
  locale: string;
  device_type: DeviceType;
  screenshot_path: string;
  created_at: string;
  updated_at: string;
}

/**
 * Screen entity (logical screen within an app)
 */
export interface Screen {
  id: number;
  app_id: number;
  // Legacy primary screenshot fields retained for backward compatibility.
  screenshot_path: string;
  device_type: DeviceType;
  position: number;
  created_at: string;
  variants: ScreenVariant[];
  localized_variants: ScreenLocalizedVariant[];
}

/**
 * Copy entity (marketing text per screen per locale)
 */
export interface Copy {
  id: number;
  screen_id: number;
  locale: string;
  title: string;
  subtitle: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Generation configuration
 */
export interface GenerationConfig {
  devices: DeviceType[];
  locales: string[];
  template_style: TemplateStyle;
  template_background?: TemplateBackground;
  include_text?: boolean;
  text_style?: TemplateTextStyle;
  frame_mode: FrameMode;
  frame_modes?: FrameModesByDevice;
  frame_asset_files?: FrameAssetFilesByDevice;
}

/**
 * Saved generation preset template
 */
export interface GenerationPreset {
  id: number;
  name: string;
  config: GenerationConfig;
  created_at: string;
  updated_at: string;
}

/**
 * Generation entity (screenshot generation run)
 */
export interface Generation {
  id: number;
  app_id: number;
  config: GenerationConfig;
  status: GenerationStatus;
  progress: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Generated screenshot entity (output of a generation run)
 */
export interface GeneratedScreenshot {
  id: number;
  generation_id: number;
  screen_id: number;
  locale: string;
  device_type: DeviceType | null;
  output_path: string;
  created_at: string;
}

/**
 * API request/response types
 */

/**
 * Request to create a new app
 */
export interface CreateAppRequest {
  name: string;
  description: string;
}

/**
 * Request to update an app
 */
export interface UpdateAppRequest {
  name?: string;
  description?: string;
}

/**
 * Request to create a screen
 */
export interface CreateScreenRequest {
  app_id: number;
  device_type: DeviceType;
  title: string;
  subtitle?: string;
}

/**
 * Request to update a screen
 */
export interface UpdateScreenRequest {
  device_type?: DeviceType;
  position?: number;
}

/**
 * Request to batch update copies
 */
export interface BatchUpdateCopiesRequest {
  updates: {
    screen_id: number;
    locale: string;
    title: string;
    subtitle?: string;
  }[];
}

/**
 * Request to generate AI translations
 */
export interface GenerateCopiesRequest {
  app_id: number;
  app_description: string;
  source_locale: string;
  target_locales: string[];
}

/**
 * Request to start screenshot generation
 */
export interface StartGenerationRequest {
  devices: DeviceType[];
  locales: string[];
  template_style: TemplateStyle;
  template_background?: TemplateBackground;
  include_text?: boolean;
  text_style?: TemplateTextStyle;
  frame_mode: FrameMode;
  frame_modes?: FrameModesByDevice;
  frame_asset_files?: FrameAssetFilesByDevice;
}

/**
 * Request to save generation preset template
 */
export interface SaveGenerationPresetRequest {
  name: string;
  config: StartGenerationRequest;
}

/**
 * App with screens included
 */
export interface AppWithScreens extends App {
  screens: Screen[];
}

/**
 * Copies organized by screen and locale
 */
export interface CopiesByScreenAndLocale {
  [screen_id: number]: {
    [locale: string]: Copy;
  };
}

/**
 * Generation with screenshots included
 */
export interface GenerationWithScreenshots extends Generation {
  screenshots: GeneratedScreenshot[];
}
