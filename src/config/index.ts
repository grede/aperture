import path from 'path';
import fs from 'fs/promises';
import { DEFAULT_CONFIG } from '../types/config.js';
import { validateConfig, type ApertureConfigSchema } from './schema.js';
import { ConfigError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration file name
 */
export const CONFIG_FILE_NAME = 'aperture.config.json';

/**
 * Load configuration from file
 */
export async function loadConfig(
  configPath?: string
): Promise<ApertureConfigSchema> {
  const filePath = configPath || path.join(process.cwd(), CONFIG_FILE_NAME);

  logger.debug({ filePath }, 'Loading configuration');

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const rawConfig = JSON.parse(content);

    // Merge with defaults
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...rawConfig,
      guardrails: {
        ...DEFAULT_CONFIG.guardrails,
        ...rawConfig.guardrails,
      },
      openai: {
        ...DEFAULT_CONFIG.openai,
        ...rawConfig.openai,
      },
    };

    // Validate
    const config = validateConfig(mergedConfig);

    logger.info({ filePath }, 'Configuration loaded successfully');
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigError(
        `Configuration file not found: ${filePath}. Run 'aperture init' to create one.`,
        'CONFIG_NOT_FOUND',
        { filePath }
      );
    }

    if (error instanceof SyntaxError) {
      throw new ConfigError(
        `Invalid JSON in configuration file: ${filePath}`,
        'CONFIG_INVALID',
        { filePath, error }
      );
    }

    throw error;
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(
  config: ApertureConfigSchema,
  configPath?: string
): Promise<void> {
  const filePath = configPath || path.join(process.cwd(), CONFIG_FILE_NAME);

  logger.debug({ filePath }, 'Saving configuration');

  // Validate before saving
  const validated = validateConfig(config);

  const content = JSON.stringify(validated, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');

  logger.info({ filePath }, 'Configuration saved successfully');
}

/**
 * Check if configuration exists
 */
export async function configExists(configPath?: string): Promise<boolean> {
  const filePath = configPath || path.join(process.cwd(), CONFIG_FILE_NAME);

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create example configuration file
 */
export async function createExampleConfig(): Promise<void> {
  const exampleConfig = {
    app: {
      path: './MyApp.app',
      bundleId: 'com.example.myapp',
    },
    locales: ['en', 'de', 'fr', 'ja', 'ko'],
    simulators: {
      iphone: 'UDID-OF-IPHONE-SIMULATOR',
      ipad: 'UDID-OF-IPAD-SIMULATOR',
    },
    templateStyle: 'modern',
    outputDir: './output',
    guardrails: {
      maxSteps: 50,
      stepTimeout: 10,
      runTimeout: 300,
      stepRetries: 2,
    },
    openai: {
      apiKey: 'sk-...',
      model: 'gpt-4o-mini',
      fallbackModel: 'gpt-4o',
      maxTokens: 1000,
    },
  };

  const filePath = path.join(process.cwd(), 'aperture.config.example.json');
  const content = JSON.stringify(exampleConfig, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');

  logger.info({ filePath }, 'Example configuration created');
}

export * from './schema.js';
