/**
 * Base error class for all Aperture-specific errors
 */
export class ApertureError extends Error {
  constructor(
    message: string,
    public code: string,
    public context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Device-related errors (Simulator connection, boot, etc.)
 */
export class DeviceError extends ApertureError {
  constructor(message: string, code: DeviceErrorCode, context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export type DeviceErrorCode =
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_BOOT_TIMEOUT'
  | 'WDA_CONNECTION_FAILED'
  | 'APP_INSTALL_FAILED'
  | 'APP_LAUNCH_FAILED';

/**
 * Step execution errors during playback
 */
export class StepFailedError extends ApertureError {
  constructor(message: string, code: StepErrorCode, context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export type StepErrorCode =
  | 'SELECTOR_NOT_FOUND'
  | 'AI_FALLBACK_FAILED'
  | 'STEP_TIMEOUT'
  | 'VERIFICATION_FAILED'
  | 'ACTION_FAILED'
  | 'MAX_STEPS_EXCEEDED'
  | 'RUN_TIMEOUT_EXCEEDED'
  | 'FORBIDDEN_ACTION';

/**
 * AI-related errors (fallback, rate limits, etc.)
 */
export class AIFallbackError extends ApertureError {
  constructor(message: string, code: AIErrorCode, context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export type AIErrorCode = 'AI_MINI_FAILED' | 'AI_FULL_FAILED' | 'AI_RATE_LIMITED' | 'AI_TIMEOUT';

/**
 * Locale switching and management errors
 */
export class LocaleError extends ApertureError {
  constructor(message: string, code: LocaleErrorCode, context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export type LocaleErrorCode =
  | 'LOCALE_SWITCH_FAILED'
  | 'LOCALE_UNSUPPORTED'
  | 'PLIST_WRITE_FAILED'
  | 'PLIST_READ_FAILED';

/**
 * Template and export errors
 */
export class ExportError extends ApertureError {
  constructor(message: string, code: ExportErrorCode, context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export type ExportErrorCode =
  | 'TEMPLATE_RENDER_FAILED'
  | 'ASSET_NOT_FOUND'
  | 'IMAGE_TOO_LARGE'
  | 'INVALID_TEMPLATE';

/**
 * Configuration errors
 */
export class ConfigError extends ApertureError {
  constructor(message: string, code: ConfigErrorCode, context: Record<string, unknown> = {}) {
    super(message, code, context);
  }
}

export type ConfigErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'CONFIG_VALIDATION_FAILED'
  | 'MISSING_REQUIRED_FIELD';
