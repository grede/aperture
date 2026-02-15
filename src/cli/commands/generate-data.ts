import { writeFile, mkdir, readFile } from 'fs/promises';
import { resolve, join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import YAML from 'yaml';
import inquirer from 'inquirer';
import { LocaleDataGenerator, type DataSchema } from '../../localization/locale-data-generator.js';
import { FlowParser } from '../../core/flow-parser.js';
import type { ApertureConfig } from '../../types/index.js';

interface GenerateDataOptions {
  regenerate?: boolean;
  locale?: string;
  model?: string;
}

export async function generateDataCommand(options: GenerateDataOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🌍 Aperture Generate Test Data\n'));

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

  // Parse flow to extract variables
  const flowParser = new FlowParser();
  let flow;

  try {
    flow = await flowParser.parse(resolve(process.cwd(), config.flow));
  } catch (error) {
    console.error(chalk.red('Error parsing flow:'), error);
    process.exit(1);
  }

  const variables = flowParser.extractVariables(flow);

  if (variables.size === 0) {
    console.log(chalk.yellow('No variables found in flow. Nothing to generate.\n'));
    return;
  }

  console.log(chalk.dim(`Found ${variables.size} variable(s): ${Array.from(variables).join(', ')}\n`));

  // Build data schema
  const schema: DataSchema = {
    variables: Array.from(variables).map((varName) => ({
      name: varName,
      description: guessVariableDescription(varName),
      type: guessVariableType(varName),
    })),
  };

  // Determine locales
  const locales = options.locale ? [options.locale] : config.locales;

  // Initialize generator
  const model = options.model ?? config.llm.defaultModel;
  const generator = new LocaleDataGenerator(config.llm.apiKey, model);

  console.log(chalk.dim(`Using model: ${model}\n`));

  // Create locales directory
  await mkdir(join(process.cwd(), 'locales'), { recursive: true });

  let generated = 0;
  let skipped = 0;

  // Generate data for each locale
  for (const locale of locales) {
    const localePath = join(process.cwd(), 'locales', `${locale}.yaml`);

    // Check if file exists
    if (!options.regenerate) {
      try {
        await readFile(localePath);
        console.log(chalk.dim(`  ⏭  ${locale}.yaml already exists (use --regenerate to overwrite)`));
        skipped++;
        continue;
      } catch {
        // File doesn't exist, continue with generation
      }
    }

    const spinner = ora(`Generating test data for ${locale}...`).start();

    try {
      const data = await generator.generate(schema, locale);

      // Save to file
      await writeFile(localePath, YAML.stringify(data));

      spinner.succeed(`Generated ${locale}.yaml`);
      generated++;
    } catch (error) {
      spinner.fail(`Failed to generate ${locale}.yaml`);
      console.error(chalk.red(`  Error: ${error}`));
    }
  }

  // Summary
  console.log(chalk.bold.green(`\n✓ Test data generation complete!\n`));
  console.log(`  Generated: ${chalk.cyan(generated)} file(s)`);
  if (skipped > 0) {
    console.log(`  Skipped: ${chalk.dim(skipped)} existing file(s)`);
  }
  console.log();
}

/**
 * Guess variable description from name
 */
function guessVariableDescription(varName: string): string {
  const name = varName.toLowerCase();

  if (name.includes('name')) return 'A person\'s name';
  if (name.includes('user')) return 'A username or display name';
  if (name.includes('group')) return 'A group or team name';
  if (name.includes('email')) return 'An email address';
  if (name.includes('address')) return 'A street address';
  if (name.includes('city')) return 'A city name';
  if (name.includes('date')) return 'A date';
  if (name.includes('time')) return 'A time';
  if (name.includes('message')) return 'A message or comment';
  if (name.includes('search')) return 'A search query';
  if (name.includes('title')) return 'A title or heading';

  return `A value for ${varName}`;
}

/**
 * Guess variable type from name
 */
function guessVariableType(varName: string): 'name' | 'text' | 'number' | 'date' | 'address' | 'custom' {
  const name = varName.toLowerCase();

  if (name.includes('name')) return 'name';
  if (name.includes('address')) return 'address';
  if (name.includes('date')) return 'date';
  if (name.includes('count') || name.includes('number')) return 'number';

  return 'text';
}
