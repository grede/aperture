import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs/promises';
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

  // Get bundle ID
  const bundleId = await getBundleId(appPath);

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
 * Run interactive wizard
 */
async function runWizard(appPath?: string): Promise<ApertureConfigSchema> {
  header('Aperture Setup Wizard');

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

  // Step 6: Guardrails (advanced users can skip)
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

  // Step 7: Confirmation
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
    openai: {
      model: 'gpt-4o-mini',
      fallbackModel: 'gpt-4o',
      maxTokens: 1000,
    },
  };
}

/**
 * Get bundle ID from app path
 */
async function getBundleId(appPath: string): Promise<string> {
  // For .ipa files, we'd need to extract first
  if (appPath.endsWith('.ipa')) {
    warning('IPA bundle ID detection not yet implemented, will be detected during install');
    return 'com.example.app'; // Placeholder
  }

  try {
    const appInfo = await deviceManager.installApp('temp', appPath).catch(() => null);
    if (appInfo) {
      return appInfo.bundleId;
    }
  } catch {
    // Fall back to placeholder
  }

  return 'com.example.app';
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
