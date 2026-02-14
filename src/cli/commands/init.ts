import { writeFile, access, readdir } from 'fs/promises';
import { resolve, join, extname, basename } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { DeviceManager } from '../../core/device-manager.js';
import YAML from 'yaml';

interface InitOptions {
  yes?: boolean;
  app?: string;
}

/**
 * Detect .app and .ipa files in the current directory
 */
async function detectAppFiles(): Promise<string[]> {
  try {
    const files = await readdir(process.cwd());
    const appFiles: string[] = [];

    for (const file of files) {
      const ext = extname(file);
      if (ext === '.app' || ext === '.ipa') {
        appFiles.push(file);
      }
    }

    return appFiles;
  } catch (error) {
    // If we can't read directory, return empty array
    return [];
  }
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🎬 Aperture Setup Wizard\n'));

  const deviceManager = new DeviceManager();

  // Detect app files in current directory
  const detectedApps = await detectAppFiles();
  let suggestedAppPath = './build/MyApp.app';

  if (detectedApps.length > 0) {
    suggestedAppPath = `./${detectedApps[0]}`;
    console.log(chalk.green(`✓ Detected app file: ${chalk.cyan(detectedApps[0])}\n`));

    if (detectedApps.length > 1) {
      console.log(chalk.dim(`  Also found: ${detectedApps.slice(1).join(', ')}\n`));
    }
  }

  // Get available devices
  const devices = await deviceManager.listDevices();

  // Sort devices: booted first, then by name
  const sortDevices = (devs: typeof devices) => {
    return devs.sort((a, b) => {
      // Booted devices come first
      if (a.state === 'Booted' && b.state !== 'Booted') return -1;
      if (a.state !== 'Booted' && b.state === 'Booted') return 1;
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  };

  const iphones = sortDevices(devices.filter((d) => d.deviceType === 'iPhone'));
  const ipads = sortDevices(devices.filter((d) => d.deviceType === 'iPad'));

  if (iphones.length === 0 || ipads.length === 0) {
    console.log(chalk.yellow('Warning: Not enough simulators found.'));
    console.log(
      chalk.dim('Make sure you have iOS Simulators installed in Xcode.')
    );
  }

  let answers;

  if (options.yes) {
    // Use defaults
    answers = {
      app: options.app ?? suggestedAppPath,
      locales: ['en-US'],
      iphone: iphones[0]?.name ?? 'iPhone 15 Pro Max',
      ipad: ipads[0]?.name ?? 'iPad Pro (13-inch) (M4)',
      style: 'minimal',
      output: './aperture-output',
      maxActionsPerStep: 10,
      stepTimeoutSec: 60,
      runTimeoutSec: 600,
      costCapUsd: 5.0,
    };
  } else {
    // Interactive prompts
    const promptQuestions: any[] = [];

    // If multiple apps detected, let user choose
    if (detectedApps.length > 1) {
      promptQuestions.push({
        type: 'list',
        name: 'app',
        message: 'Select your app:',
        choices: [
          ...detectedApps.map((app) => ({
            name: `${app} (detected)`,
            value: `./${app}`,
          })),
          {
            name: 'Other (enter manually)',
            value: '__manual__',
          },
        ],
      });
    } else {
      promptQuestions.push({
        type: 'input',
        name: 'app',
        message: 'Path to your .app bundle:',
        default: options.app ?? suggestedAppPath,
      });
    }

    // If user selects manual, ask for path
    let initialAnswers = await inquirer.prompt(promptQuestions);

    if (initialAnswers.app === '__manual__') {
      const { manualPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualPath',
          message: 'Enter path to your .app bundle:',
          default: './build/MyApp.app',
        },
      ]);
      initialAnswers.app = manualPath;
    }

    // Continue with remaining prompts
    const remainingAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'locales',
        message: 'Select target locales:',
        choices: [
          { name: 'English (US)', value: 'en-US', checked: true },
          { name: 'German', value: 'de' },
          { name: 'French', value: 'fr' },
          { name: 'Spanish', value: 'es' },
          { name: 'Japanese', value: 'ja' },
          { name: 'Chinese (Simplified)', value: 'zh-Hans' },
          { name: 'Portuguese (Brazil)', value: 'pt-BR' },
          { name: 'Italian', value: 'it' },
          { name: 'Korean', value: 'ko' },
          { name: 'Arabic', value: 'ar' },
        ],
        validate: (input: string[]) =>
          input.length > 0 || 'Please select at least one locale',
      },
      {
        type: 'list',
        name: 'iphone',
        message: 'Select iPhone simulator:',
        choices: iphones.map((d) => ({
          name: d.state === 'Booted'
            ? `${chalk.green('●')} ${d.name} ${chalk.dim('(booted)')}`
            : `${chalk.dim('○')} ${d.name}`,
          value: d.name,
        })),
        default: 0,
      },
      {
        type: 'list',
        name: 'ipad',
        message: 'Select iPad simulator:',
        choices: [
          {
            name: chalk.yellow('⊗ Skip iPad (iPhone only)'),
            value: '__skip__',
          },
          ...ipads.map((d) => ({
            name: d.state === 'Booted'
              ? `${chalk.green('●')} ${d.name} ${chalk.dim('(booted)')}`
              : `${chalk.dim('○')} ${d.name}`,
            value: d.name,
          })),
        ],
        default: 0,
      },
      {
        type: 'list',
        name: 'style',
        message: 'Select template style:',
        choices: [
          { name: 'Minimal (white background, thin frame)', value: 'minimal' },
          { name: 'Modern (gradient background, floating device)', value: 'modern' },
          { name: 'Gradient (bold gradient, angled device)', value: 'gradient' },
          { name: 'Dark (dark background, glowing edges)', value: 'dark' },
          { name: 'Playful (colorful shapes, rotated device)', value: 'playful' },
        ],
        default: 0,
      },
      {
        type: 'input',
        name: 'output',
        message: 'Output directory:',
        default: './aperture-output',
      },
      {
        type: 'number',
        name: 'maxActionsPerStep',
        message: 'Max actions per navigation step:',
        default: 10,
      },
      {
        type: 'number',
        name: 'stepTimeoutSec',
        message: 'Step timeout (seconds):',
        default: 60,
      },
      {
        type: 'number',
        name: 'runTimeoutSec',
        message: 'Run timeout (seconds):',
        default: 600,
      },
      {
        type: 'number',
        name: 'costCapUsd',
        message: 'Cost cap (USD):',
        default: 5.0,
      },
    ]);

    // Merge answers
    answers = { ...initialAnswers, ...remainingAnswers };
  }

  // Create config
  const config: any = {
    app: answers.app,
    bundleId: 'com.example.myapp',
    flow: './aperture-flow.yaml',
    locales: answers.locales,
    devices: {
      iphone: answers.iphone,
    },
    template: {
      style: answers.style,
    },
    output: answers.output,
    guardrails: {
      maxActionsPerStep: answers.maxActionsPerStep,
      stepTimeoutSec: answers.stepTimeoutSec,
      runTimeoutSec: answers.runTimeoutSec,
      costCapUsd: answers.costCapUsd,
      forbiddenActions: [],
    },
    llm: {
      apiKey: '${OPENAI_API_KEY}',
      defaultModel: 'gpt-4o-mini',
      escalationModel: 'gpt-4o',
      escalateAfterAttempts: 5,
    },
    mcp: {
      endpoint: 'stdio://mobile-mcp',
    },
  };

  // Add iPad to devices if not skipped
  if (answers.ipad && answers.ipad !== '__skip__') {
    config.devices.ipad = answers.ipad;
  }

  // Example flow
  const exampleFlow = {
    app: answers.app,
    steps: [
      {
        action: 'navigate',
        instruction: 'Dismiss any onboarding or debug dialogs and get to the main screen',
      },
      {
        action: 'screenshot',
        label: 'main_screen',
      },
      {
        action: 'navigate',
        instruction: 'Open the settings screen',
      },
      {
        action: 'screenshot',
        label: 'settings',
      },
    ],
  };

  // Write files
  const configPath = resolve(process.cwd(), 'aperture.config.yaml');
  const flowPath = resolve(process.cwd(), 'aperture-flow.yaml');

  try {
    // Check if files already exist
    try {
      await access(configPath);
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'aperture.config.yaml already exists. Overwrite?',
          default: false,
        },
      ]);
      if (!overwrite) {
        console.log(chalk.yellow('\nSetup cancelled.'));
        return;
      }
    } catch {
      // File doesn't exist, continue
    }

    await writeFile(configPath, YAML.stringify(config));
    await writeFile(flowPath, YAML.stringify(exampleFlow));

    console.log(chalk.green('\n✓ Configuration created successfully!\n'));
    console.log(chalk.dim(`  Config: ${configPath}`));
    console.log(chalk.dim(`  Flow:   ${flowPath}\n`));

    console.log(chalk.bold('Next steps:\n'));
    console.log(`  1. Edit ${chalk.cyan('aperture-flow.yaml')} to define your screenshot flow`);
    console.log(`  2. Set your OpenAI API key: ${chalk.cyan('export OPENAI_API_KEY=sk-...')}`);
    console.log(`  3. Run ${chalk.cyan('aperture run')} to generate screenshots\n`);
  } catch (error) {
    console.error(chalk.red('Error writing configuration:'), error);
    process.exit(1);
  }
}
