/**
 * Main Aperture project configuration
 */
export interface ApertureConfig {
  /** App bundle information */
  app: AppConfig;
  /** Target locales for screenshot generation */
  locales: string[];
  /** Simulator configuration */
  simulators: SimulatorConfig;
  /** Template style for export */
  templateStyle: TemplateStyle;
  /** Output directory for generated files */
  outputDir: string;
  /** Safety guardrails */
  guardrails: GuardrailsConfig;
  /** OpenAI API configuration */
  openai?: OpenAIConfig;
}

/**
 * App configuration
 */
export interface AppConfig {
  /** Path to .app or .ipa bundle */
  path: string;
  /** Bundle identifier (auto-detected if not provided) */
  bundleId?: string;
  /** App name (optional) */
  name?: string;
}

/**
 * Simulator configuration
 */
export interface SimulatorConfig {
  /** iPhone Simulator UDID */
  iphone?: string;
  /** iPad Simulator UDID */
  ipad?: string;
}

/**
 * Safety guardrails configuration
 */
export interface GuardrailsConfig {
  /** Maximum steps per recording */
  maxSteps: number;
  /** Per-step timeout (seconds) */
  stepTimeout: number;
  /** Total run timeout (seconds) */
  runTimeout: number;
  /** Number of retries per step */
  stepRetries: number;
  /** Forbidden actions (not implemented yet) */
  forbiddenActions?: string[];
}

/**
 * OpenAI API configuration
 */
export interface OpenAIConfig {
  /** API key */
  apiKey?: string;
  /** Model for parameterization and fallback (e.g., gpt-4o-mini, gpt-4o, o1-mini, o1) */
  model: string;
  /** Fallback model if primary fails */
  fallbackModel?: string;
  /** Max tokens per request */
  maxTokens?: number;
}

/**
 * Template styles
 */
export type TemplateStyle = 'minimal' | 'modern' | 'gradient' | 'dark' | 'playful';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<ApertureConfig> = {
  locales: ['en'],
  templateStyle: 'modern',
  outputDir: './output',
  guardrails: {
    maxSteps: 50,
    stepTimeout: 10,
    runTimeout: 300,
    stepRetries: 2,
  },
  openai: {
    model: 'gpt-4o-mini',
    fallbackModel: 'gpt-4o',
    maxTokens: 1000,
  },
};
