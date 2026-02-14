import { writeFile, access } from 'fs/promises';
import { resolve } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { DeviceManager } from '../../core/device-manager.js';
import YAML from 'yaml';

interface InitOptions {
  yes?: boolean;
  app?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🎬 Aperture Setup Wizard\n'));

  const deviceManager = new DeviceManager();

  // Get available devices
  const devices = await deviceManager.listDevices();
  const iphones = devices.filter((d) => d.deviceType === 'iPhone');
  const ipads = devices.filter((d) => d.deviceType === 'iPad');

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
      app: options.app ?? './build/MyApp.app',
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
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'app',
        message: 'Path to your .app bundle:',
        default: options.app ?? './build/MyApp.app',
      },
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
        choices: iphones.map((d) => ({ name: d.name, value: d.name })),
        default: 0,
      },
      {
        type: 'list',
        name: 'ipad',
        message: 'Select iPad simulator:',
        choices: ipads.map((d) => ({ name: d.name, value: d.name })),
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
  }

  // Create config
  const config = {
    app: answers.app,
    bundleId: 'com.example.myapp',
    flow: './aperture-flow.yaml',
    locales: answers.locales,
    devices: {
      iphone: answers.iphone,
      ipad: answers.ipad,
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
