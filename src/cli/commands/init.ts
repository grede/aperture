import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { deviceManager } from '../../core/device-manager.js';
import { saveConfig, configExists } from '../../config/index.js';
import type { ApertureConfigSchema } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';
import { banner, success, error, warning, header, keyValue } from '../ui.js';

/**
 * Common locale options
 */
const COMMON_LOCALES = [
  { name: 'English', value: 'en' },
  { name: 'German (Deutsch)', value: 'de' },
  { name: 'French (Français)', value: 'fr' },
  { name: 'Spanish (Español)', value: 'es' },
  { name: 'Japanese (日本語)', value: 'ja' },
  { name: 'Korean (한국어)', value: 'ko' },
  { name: 'Chinese Simplified (简体中文)', value: 'zh-Hans' },
  { name: 'Chinese Traditional (繁體中文)', value: 'zh-Hant' },
  { name: 'Portuguese (Português)', value: 'pt' },
  { name: 'Russian (Русский)', value: 'ru' },
  { name: 'Italian (Italiano)', value: 'it' },
  { name: 'Dutch (Nederlands)', value: 'nl' },
  { name: 'Arabic (العربية)', value: 'ar' },
  { name: 'Hindi (हिन्दी)', value: 'hi' },
  { name: 'Thai (ไทย)', value: 'th' },
  { name: 'Vietnamese (Tiếng Việt)', value: 'vi' },
];

/**
 * Template style options
 */
const TEMPLATE_STYLES = [
  { name: 'Modern - Clean and professional (Recommended)', value: 'modern' },
  { name: 'Minimal - Simple and understated', value: 'minimal' },
  { name: 'Gradient - Vibrant gradient backgrounds', value: 'gradient' },
  { name: 'Dark - Dark theme with high contrast', value: 'dark' },
  { name: 'Playful - Fun and colorful', value: 'playful' },
];

/**
 * Init command options
 */
export interface InitOptions {
  yes?: boolean;
  app?: string;
}

/**
 * Interactive setup wizard (US-008)
 */
export async function initCommand(options: InitOptions = {}) {
  try {
    banner();

    // Check if config already exists
    if (await configExists()) {
      const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Configuration file already exists. Overwrite?',
          default: false,
        },
      ]);

      if (!overwrite) {
        warning('Initialization cancelled');
        return;
      }
    }

    let config: ApertureConfigSchema;

    if (options.yes) {
      // Non-interactive mode with defaults
      config = await createDefaultConfig(options.app);
      success('Configuration created with defaults');
    } else {
      // Interactive wizard
      config = await runWizard(options.app);
    }

    // Save configuration
    await saveConfig(config);

    // Print summary
    printSummary(config);

    success('Project initialized successfully! 🎉');
    console.log();
    console.log('Next steps:');
    console.log('  1. Run: aperture record');
    console.log('  2. Walk through your app and mark screenshot points');
    console.log('  3. Run: aperture run <recording> --locales all');
    console.log();
  } catch (err) {
    logger.error({ error: err }, 'Init command failed');
    error(`Failed to initialize project: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Create default configuration
 */
async function createDefaultConfig(appPath?: string): Promise<ApertureConfigSchema> {
  if (!appPath) {
    throw new Error('App path is required in non-interactive mode (--app flag)');
  }

  // Verify app exists
  try {
    await fs.access(appPath);
  } catch {
    throw new Error(`App bundle not found: ${appPath}`);
  }

  // Get bundle ID (non-interactive mode - must succeed or fail)
  let bundleId: string;
  try {
    bundleId = await deviceManager.getBundleId(appPath);
  } catch (err) {
    throw new Error(
      `Failed to auto-detect bundle ID from ${appPath}: ${(err as Error).message}\n\n` +
        'In non-interactive mode, automatic bundle ID detection must succeed.\n' +
        'Please verify your app bundle is valid, or run without --yes flag to enter bundle ID manually.'
    );
  }

  // Get first booted device or throw
  const bootedDevices = await deviceManager.getBootedDevices();
  const iphone = bootedDevices.find((d) => d.deviceType === 'iPhone');

  if (!iphone) {
    throw new Error(
      'No booted iPhone Simulator found. Please boot a Simulator first:\n' +
        '  xcrun simctl boot <UDID>'
    );
  }

  return {
    app: {
      path: appPath,
      bundleId,
      name: path.basename(appPath, '.app'),
    },
    locales: ['en'],
    simulators: {
      iphone: iphone.udid,
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
      model: 'gpt-4o-mini',
      fallbackModel: 'gpt-4o',
      maxTokens: 1000,
    },
  };
}

/**
 * Auto-detect .app or .ipa files in current directory
 */
async function detectAppBundle(): Promise<string | undefined> {
  try {
    const files = await fs.readdir('.');

    // Look for .ipa files first (most common for distribution)
    const ipaFile = files.find((f) => f.endsWith('.ipa'));
    if (ipaFile) {
      return `./${ipaFile}`;
    }

    // Then look for .app bundles
    const appFile = files.find((f) => f.endsWith('.app'));
    if (appFile) {
      return `./${appFile}`;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch available models from OpenAI API
 */
async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.models.list();

    // Filter for GPT models that are suitable for chat/completion
    const models = response.data
      .filter((model) => {
        const id = model.id.toLowerCase();
        // Include GPT-4, GPT-3.5, and o1 models
        return (
          (id.includes('gpt-4') || id.includes('gpt-3.5') || id.startsWith('o1')) &&
          !id.includes('vision') && // Exclude vision-only models
          !id.includes('instruct') // Exclude instruct variants
        );
      })
      .map((model) => model.id)
      .sort((a, b) => {
        // Sort by preference: o1 > gpt-4 > gpt-3.5
        const order = ['o1', 'gpt-4', 'gpt-3.5'];
        const aIndex = order.findIndex((prefix) => a.startsWith(prefix));
        const bIndex = order.findIndex((prefix) => b.startsWith(prefix));
        if (aIndex !== bIndex) return aIndex - bIndex;
        return b.localeCompare(a); // Newer versions first
      });

    return models;
  } catch (err) {
    logger.debug({ error: err }, 'Failed to fetch OpenAI models');
    return [];
  }
}

/**
 * Get model choices with fallback to defaults + manual entry
 */
async function getModelChoices(apiKey?: string): Promise<Array<{ name: string; value: string }>> {
  let availableModels: string[] = [];

  if (apiKey) {
    availableModels = await fetchAvailableModels(apiKey);
  }

  if (availableModels.length > 0) {
    return [
      ...availableModels.map((model) => ({
        name: model,
        value: model,
      })),
      { name: 'Other (enter manually)', value: '__custom__' },
    ];
  }

  // Fallback to hardcoded list if API call fails
  return [
    { name: 'gpt-4o-mini (Recommended - faster, cheaper)', value: 'gpt-4o-mini' },
    { name: 'gpt-4o', value: 'gpt-4o' },
    { name: 'gpt-4-turbo', value: 'gpt-4-turbo' },
    { name: 'o1-mini', value: 'o1-mini' },
    { name: 'o1', value: 'o1' },
    { name: 'Other (enter manually)', value: '__custom__' },
  ];
}

/**
 * Run interactive wizard
 */
async function runWizard(appPath?: string): Promise<ApertureConfigSchema> {
  header('Aperture Setup Wizard');

  // Auto-detect app bundle in current directory if not provided
  if (!appPath) {
    appPath = await detectAppBundle();
  }

  // Step 1: App path
  const appAnswer = await inquirer.prompt<{ appPath: string }>([
    {
      type: 'input',
      name: 'appPath',
      message: 'Path to your .app or .ipa bundle:',
      default: appPath || './MyApp.app',
      validate: async (input: string) => {
        try {
          await fs.access(input);
          return true;
        } catch {
          return `File not found: ${input}`;
        }
      },
    },
  ]);

  // Auto-detect bundle ID
  const bundleId = await getBundleId(appAnswer.appPath);
  success(`Detected bundle ID: ${bundleId}`);

  // Step 2: Target locales
  const localeAnswer = await inquirer.prompt<{ locales: string[] }>([
    {
      type: 'checkbox',
      name: 'locales',
      message: 'Select target locales (use space to select):',
      choices: COMMON_LOCALES,
      default: ['en'],
      validate: (input: string[]) => {
        if (input.length === 0) {
          return 'Please select at least one locale';
        }
        return true;
      },
    },
  ]);

  // Step 3: Simulators
  const devices = await deviceManager.listDevices();
  const iPhones = devices.filter((d) => d.deviceType === 'iPhone');
  const iPads = devices.filter((d) => d.deviceType === 'iPad');

  if (iPhones.length === 0) {
    throw new Error('No iPhone Simulators found. Please install Xcode and iOS Simulators.');
  }

  const deviceChoices = iPhones.map((d) => ({
    name: `${d.name} (iOS ${d.version}) ${d.state === 'Booted' ? '✓ Booted' : ''}`,
    value: d.udid,
  }));

  const simulatorAnswer = await inquirer.prompt<{ iphone: string; addIpad: boolean }>([
    {
      type: 'list',
      name: 'iphone',
      message: 'Select iPhone Simulator:',
      choices: deviceChoices,
      default: deviceChoices.find((c) => c.name.includes('Booted'))?.value || deviceChoices[0]?.value,
    },
    {
      type: 'confirm',
      name: 'addIpad',
      message: 'Add iPad Simulator for 13" screenshots?',
      default: iPads.length > 0,
      when: () => iPads.length > 0,
    },
  ]);

  let ipadUdid: string | undefined;
  if (simulatorAnswer.addIpad && iPads.length > 0) {
    const iPadChoices = iPads.map((d) => ({
      name: `${d.name} (iOS ${d.version}) ${d.state === 'Booted' ? '✓ Booted' : ''}`,
      value: d.udid,
    }));

    const ipadAnswer = await inquirer.prompt<{ ipad: string }>([
      {
        type: 'list',
        name: 'ipad',
        message: 'Select iPad Simulator:',
        choices: iPadChoices,
        default: iPadChoices[0]?.value,
      },
    ]);

    ipadUdid = ipadAnswer.ipad;
  }

  // Step 4: Template style
  const styleAnswer = await inquirer.prompt<{ style: string }>([
    {
      type: 'list',
      name: 'style',
      message: 'Choose template style:',
      choices: TEMPLATE_STYLES,
      default: 'modern',
    },
  ]);

  // Step 5: Output directory
  const outputAnswer = await inquirer.prompt<{ outputDir: string }>([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory for generated files:',
      default: './output',
    },
  ]);

  // Step 6: OpenAI Configuration
  console.log();
  console.log('OpenAI API is used for:');
  console.log('  • Parameterization (detecting locale-dependent inputs)');
  console.log('  • Locale data generation (creating test data per language)');
  console.log('  • Translations (adapting marketing copy)');
  console.log('  • AI fallback (finding elements when selectors fail)');
  console.log();

  const { configureOpenAI } = await inquirer.prompt<{ configureOpenAI: boolean }>([
    {
      type: 'confirm',
      name: 'configureOpenAI',
      message: 'Configure OpenAI API key now?',
      default: !!process.env.OPENAI_API_KEY, // Default to no if env var exists
    },
  ]);

  let openaiConfig = {
    model: 'gpt-4o-mini' as string,
    fallbackModel: 'gpt-4o' as string,
    maxTokens: 1000,
    apiKey: undefined as string | undefined,
  };

  if (configureOpenAI) {
    // First, get API key
    const apiKeyAnswer = await inquirer.prompt<{ apiKey: string }>([
      {
        type: 'password',
        name: 'apiKey',
        message: 'OpenAI API key (starts with sk-...):',
        mask: '*',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'API key cannot be empty';
          }
          if (!input.startsWith('sk-')) {
            return 'OpenAI API keys start with "sk-"';
          }
          return true;
        },
      },
    ]);

    openaiConfig.apiKey = apiKeyAnswer.apiKey;

    // Fetch available models using the API key
    console.log();
    console.log('⏳ Fetching available models from OpenAI...');
    const modelChoices = await getModelChoices(apiKeyAnswer.apiKey);
    if (modelChoices.length > 0 && modelChoices[0].value !== '__custom__') {
      success('✓ Loaded latest model list from OpenAI API');
    } else {
      warning('⚠ Could not fetch models, showing default options');
    }
    console.log();

    // Ask for model selection
    const modelAnswer = await inquirer.prompt<{
      model: string;
      configureAdvanced: boolean;
    }>([
      {
        type: 'list',
        name: 'model',
        message: 'Primary model:',
        choices: modelChoices,
        default: 'gpt-4o-mini',
      },
      {
        type: 'confirm',
        name: 'configureAdvanced',
        message: 'Configure advanced OpenAI settings? (fallback model, max tokens)',
        default: false,
      },
    ]);

    // If user selected custom, prompt for manual entry
    if (modelAnswer.model === '__custom__') {
      const customModel = await inquirer.prompt<{ customModel: string }>([
        {
          type: 'input',
          name: 'customModel',
          message: 'Enter model name (e.g., gpt-4o-mini, o1-preview):',
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Model name cannot be empty';
            }
            return true;
          },
        },
      ]);
      openaiConfig.model = customModel.customModel;
    } else {
      openaiConfig.model = modelAnswer.model;
    }

    if (modelAnswer.configureAdvanced) {
      const advancedAnswers = await inquirer.prompt<{
        fallbackModel: string;
        maxTokens: number;
      }>([
        {
          type: 'list',
          name: 'fallbackModel',
          message: 'Fallback model (used if primary model fails):',
          choices: modelChoices,
          default: openaiConfig.model === 'gpt-4o-mini' ? 'gpt-4o' : 'gpt-4o-mini',
        },
        {
          type: 'number',
          name: 'maxTokens',
          message: 'Maximum tokens per request:',
          default: 1000,
        },
      ]);

      // If user selected custom for fallback model, prompt for manual entry
      if (advancedAnswers.fallbackModel === '__custom__') {
        const customFallback = await inquirer.prompt<{ customModel: string }>([
          {
            type: 'input',
            name: 'customModel',
            message: 'Enter fallback model name:',
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return 'Model name cannot be empty';
              }
              return true;
            },
          },
        ]);
        openaiConfig.fallbackModel = customFallback.customModel;
      } else {
        openaiConfig.fallbackModel = advancedAnswers.fallbackModel;
      }

      openaiConfig.maxTokens = advancedAnswers.maxTokens;
    }
  } else {
    // User skipped OpenAI config
    if (process.env.OPENAI_API_KEY) {
      success('Will use OPENAI_API_KEY environment variable');
    } else {
      warning('OpenAI not configured. You can add it later to aperture.config.json or set OPENAI_API_KEY env var');
    }
  }

  // Step 7: Guardrails (advanced users can skip)
  const { configureGuardrails } = await inquirer.prompt<{ configureGuardrails: boolean }>([
    {
      type: 'confirm',
      name: 'configureGuardrails',
      message: 'Configure safety guardrails? (max steps, timeouts)',
      default: false,
    },
  ]);

  let guardrails = {
    maxSteps: 50,
    stepTimeout: 10,
    runTimeout: 300,
    stepRetries: 2,
  };

  if (configureGuardrails) {
    guardrails = await inquirer.prompt([
      {
        type: 'number',
        name: 'maxSteps',
        message: 'Maximum steps per recording:',
        default: 50,
      },
      {
        type: 'number',
        name: 'stepTimeout',
        message: 'Per-step timeout (seconds):',
        default: 10,
      },
      {
        type: 'number',
        name: 'runTimeout',
        message: 'Total run timeout (seconds):',
        default: 300,
      },
      {
        type: 'number',
        name: 'stepRetries',
        message: 'Number of retries per step:',
        default: 2,
      },
    ]);
  }

  // Step 8: Confirmation
  console.log();
  header('Configuration Summary');
  keyValue('App', appAnswer.appPath);
  keyValue('Bundle ID', bundleId);
  keyValue('Locales', localeAnswer.locales.join(', '));
  keyValue('iPhone Simulator', devices.find((d) => d.udid === simulatorAnswer.iphone)?.name || 'Unknown');
  if (ipadUdid) {
    keyValue('iPad Simulator', devices.find((d) => d.udid === ipadUdid)?.name || 'Unknown');
  }
  keyValue('Template Style', styleAnswer.style);
  keyValue('Output Directory', outputAnswer.outputDir);
  keyValue(
    'OpenAI API',
    openaiConfig.apiKey
      ? `Configured (${openaiConfig.model})`
      : process.env.OPENAI_API_KEY
        ? 'Using OPENAI_API_KEY env var'
        : 'Not configured'
  );
  console.log();

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Create configuration with these settings?',
      default: true,
    },
  ]);

  if (!confirm) {
    throw new Error('Configuration cancelled by user');
  }

  return {
    app: {
      path: appAnswer.appPath,
      bundleId,
      name: path.basename(appAnswer.appPath, '.app'),
    },
    locales: localeAnswer.locales,
    simulators: {
      iphone: simulatorAnswer.iphone,
      ipad: ipadUdid,
    },
    templateStyle: styleAnswer.style as 'minimal' | 'modern' | 'gradient' | 'dark' | 'playful',
    outputDir: outputAnswer.outputDir,
    guardrails,
    openai: openaiConfig.apiKey
      ? {
          apiKey: openaiConfig.apiKey,
          model: openaiConfig.model,
          fallbackModel: openaiConfig.fallbackModel,
          maxTokens: openaiConfig.maxTokens,
        }
      : {
          model: openaiConfig.model,
          fallbackModel: openaiConfig.fallbackModel,
          maxTokens: openaiConfig.maxTokens,
        },
  };
}

/**
 * Get bundle ID from app path (.app or .ipa)
 * If auto-detection fails, prompts user to enter it manually
 */
async function getBundleId(appPath: string): Promise<string> {
  try {
    // Use deviceManager's getBundleId which handles both .app and .ipa files
    const bundleId = await deviceManager.getBundleId(appPath);
    return bundleId;
  } catch (err) {
    // If extraction fails, prompt user to enter bundle ID manually
    warning(`Failed to auto-detect bundle ID: ${(err as Error).message}`);
    console.log();

    const answer = await inquirer.prompt<{ bundleId: string }>([
      {
        type: 'input',
        name: 'bundleId',
        message: 'Enter the bundle ID manually (e.g., com.example.app):',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Bundle ID cannot be empty';
          }
          // Basic validation: should follow reverse domain notation
          if (!/^[a-zA-Z0-9.-]+$/.test(input)) {
            return 'Bundle ID should only contain letters, numbers, dots, and hyphens';
          }
          if (input.split('.').length < 2) {
            return 'Bundle ID should follow reverse domain notation (e.g., com.example.app)';
          }
          return true;
        },
      },
    ]);

    return answer.bundleId.trim();
  }
}

/**
 * Print configuration summary
 */
function printSummary(config: ApertureConfigSchema): void {
  console.log();
  header('Configuration Created');
  keyValue('Config file', 'aperture.config.json');
  keyValue('App', config.app.path);
  keyValue('Locales', `${config.locales.length} language(s)`);
  keyValue('Template', config.templateStyle);
  console.log();
}
