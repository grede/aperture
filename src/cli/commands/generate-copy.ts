import { writeFile, mkdir, readFile, readdir } from 'fs/promises';
import { resolve, join, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import YAML from 'yaml';
import { TranslationService } from '../../localization/translation-service.js';
import type { ApertureConfig } from '../../types/index.js';
import inquirer from 'inquirer';

interface GenerateCopyOptions {
  regenerate?: boolean;
  locale?: string;
  model?: string;
  description?: string;
}

interface ScreenshotContext {
  [label: string]: string;
}

export async function generateCopyCommand(options: GenerateCopyOptions): Promise<void> {
  console.log(chalk.bold.blue('\n✍️  Aperture Generate Marketing Copy\n'));

  // Load config
  const configPath = resolve(process.cwd(), 'aperture.config.yaml');
  let config: ApertureConfig;

  try {
    const configContent = await readFile(configPath, 'utf-8');
    config = YAML.parse(configContent) as ApertureConfig;

    // Resolve API key
    if (config.llm.apiKey.startsWith('${')) {
      const envVar = config.llm.apiKey.slice(2, -1);
      config.llm.apiKey = process.env[envVar] ?? '';

      if (!config.llm.apiKey) {
        console.log(chalk.yellow(`\n⚠  Environment variable ${envVar} not set\n`));

        const { apiKey } = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: 'Please enter your OpenAI API key:',
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return 'API key cannot be empty';
              }
              if (!input.startsWith('sk-')) {
                return 'OpenAI API keys typically start with "sk-"';
              }
              return true;
            },
          },
        ]);

        config.llm.apiKey = apiKey;
        console.log(chalk.dim('Using provided API key for this session\n'));
      }
    }
  } catch (error) {
    console.error(chalk.red('Error loading config:'), error);
    process.exit(1);
  }

  // Get app description from config, command-line flag, or prompt
  let appDescription: string;

  if (options.description) {
    // Command-line flag takes precedence
    appDescription = options.description;
  } else if (config.appDescription) {
    // Use from config
    appDescription = config.appDescription;
    console.log(chalk.dim(`Using app description from config: "${appDescription}"\n`));
  } else {
    // Fall back to prompting
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'appDescription',
        message: 'Brief app description (for context):',
        default: 'A mobile application',
      },
    ]);
    appDescription = answer.appDescription;
  }

  // Find all screenshot labels from the first locale
  const firstLocale = config.locales[0];
  const screenshotsDir = join(config.output, firstLocale, 'iphone');
  let screenshotLabels: string[] = [];

  try {
    const files = await readdir(screenshotsDir);
    screenshotLabels = files
      .filter((f) => f.endsWith('.png'))
      .map((f) => basename(f, '.png'));

    if (screenshotLabels.length === 0) {
      console.log(chalk.red(`No screenshots found in ${screenshotsDir}`));
      console.log(chalk.dim('Run aperture run first to generate screenshots.\n'));
      process.exit(1);
    }

    console.log(chalk.dim(`Found ${screenshotLabels.length} screenshot(s)\n`));
  } catch (error) {
    console.log(chalk.red(`Could not read screenshots directory: ${screenshotsDir}`));
    process.exit(1);
  }

  // Prompt for context for each screenshot
  const screenshotContext: ScreenshotContext = {};

  for (const label of screenshotLabels) {
    const { context } = await inquirer.prompt([
      {
        type: 'input',
        name: 'context',
        message: `Context for "${label}":`,
        default: `Shows the ${label.replace(/_/g, ' ')} screen`,
      },
    ]);
    screenshotContext[label] = context;
  }

  // Initialize translation service
  const model = options.model ?? config.llm.defaultModel;
  const translationService = new TranslationService(config.llm.apiKey, model);

  console.log(chalk.dim(`Using model: ${model}\n`));

  // Create locales directory
  await mkdir(join(process.cwd(), 'locales'), { recursive: true });

  // Determine locales
  const locales = options.locale ? [options.locale] : config.locales;

  let generated = 0;
  let skipped = 0;

  // Generate copy for each locale
  for (const locale of locales) {
    const copyPath = join(process.cwd(), 'locales', `${locale}-copy.yaml`);

    // Check if file exists
    if (!options.regenerate) {
      try {
        await readFile(copyPath);
        console.log(chalk.dim(`\n⏭  ${locale}-copy.yaml already exists (use --regenerate to overwrite)`));
        skipped++;
        continue;
      } catch {
        // File doesn't exist, continue with generation
      }
    }

    console.log(chalk.bold(`\n${locale}`));

    const localeCopy: Record<string, { title: string; subtitle: string }> = {};

    for (const label of screenshotLabels) {
      const spinner = ora(`  Generating copy for "${label}"...`).start();

      try {
        const copy = await translationService.generateCopy(
          label,
          locale,
          appDescription,
          screenshotContext[label]
        );

        localeCopy[label] = copy;
        spinner.succeed(`  ${label}: "${copy.title}"`);
      } catch (error) {
        spinner.fail(`  Failed to generate copy for "${label}"`);
        console.error(chalk.red(`    Error: ${error}`));
      }
    }

    // Save to file
    await writeFile(copyPath, YAML.stringify(localeCopy));
    console.log(chalk.green(`  ✓ Saved to ${copyPath}`));
    generated++;
  }

  // Summary
  console.log(chalk.bold.green(`\n✓ Marketing copy generation complete!\n`));
  console.log(`  Generated: ${chalk.cyan(generated)} file(s)`);
  if (skipped > 0) {
    console.log(`  Skipped: ${chalk.dim(skipped)} existing file(s)`);
  }
  console.log();
}
