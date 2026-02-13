import { Command } from 'commander';
import inquirer from 'inquirer';
import { parameterizer } from '../../core/parameterizer.js';
import { localeDataGenerator } from '../../core/locale-data-generator.js';
import { aiClient } from '../../utils/ai-client.js';
import { loadConfig, saveConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { KNOWN_LOCALES } from '../../types/locale.js';
import { success, error, warning, header, info, createSpinner } from '../ui.js';

/**
 * Locales command group (US-010)
 */
export const localesCommand = new Command('locales')
  .description('Manage locale-specific test data')
  .addCommand(
    new Command('generate')
      .description('Generate test data for configured locales (US-010)')
      .option('--template <name>', 'Template name to generate data for')
      .option('--force', 'Regenerate even if data exists')
      .action(async (options) => {
        try {
          header('Locale Data Generation');

          // Load config
          const config = await loadConfig();

          // Initialize AI client
          if (config.openai?.apiKey) {
            aiClient.initialize({
              apiKey: config.openai.apiKey,
              model: config.openai.model,
              fallbackModel: config.openai.fallbackModel,
              maxTokens: config.openai.maxTokens,
            });
          } else {
            error('OpenAI API key not configured');
            console.log();
            console.log('Add your API key to aperture.config.json');
            process.exit(1);
          }

          // Get template name
          let templateName = options.template;
          if (!templateName) {
            const { name } = await inquirer.prompt<{ name: string }>([
              {
                type: 'input',
                name: 'name',
                message: 'Template name:',
                validate: (input) => (input.length > 0 ? true : 'Name is required'),
              },
            ]);
            templateName = name;
          }

          // Load template
          info(`Loading template: ${templateName}`);
          const template = await parameterizer.loadTemplate(templateName);

          console.log();
          info(`Template: ${template.name}`);
          info(`Parameters: ${template.parameters.length}`);
          info(`Configured locales: ${config.locales.join(', ')}`);
          console.log();

          if (template.parameters.length === 0) {
            warning('Template has no parameters');
            console.log('Nothing to generate.');
            process.exit(0);
          }

          // Determine which locales need generation
          const localesToGenerate: string[] = [];
          for (const locale of config.locales) {
            const isValid = await localeDataGenerator.isValid(locale, template.recordingHash);
            if (options.force || !isValid) {
              localesToGenerate.push(locale);
            }
          }

          if (localesToGenerate.length === 0) {
            success('All locale data is up to date!');
            console.log();
            console.log('Use --force to regenerate.');
            process.exit(0);
          }

          info(`Generating data for ${localesToGenerate.length} locale(s): ${localesToGenerate.join(', ')}`);
          console.log();

          // Generate data for each locale
          let totalTokens = 0;
          for (const locale of localesToGenerate) {
            const spinner = createSpinner(`Generating ${locale}...`).start();
            try {
              const localeData = await localeDataGenerator.generate(template, locale);
              await localeDataGenerator.saveLocaleData(localeData);
              totalTokens += localeData.tokensUsed || 0;
              spinner.succeed(`${locale}: ${Object.keys(localeData.parameters).length} parameters generated`);
            } catch (err) {
              spinner.fail(`${locale}: ${(err as Error).message}`);
              logger.error({ locale, error: err }, 'Failed to generate locale data');
            }
          }

          console.log();
          success('Locale data generation complete! 🎉');
          console.log();
          console.log('Summary:');
          console.log(`  Locales generated: ${localesToGenerate.length}`);
          console.log(`  Total tokens used: ${totalTokens}`);
          console.log();
          console.log('Next steps:');
          console.log(`  aperture run ${template.name} --locales all`);
          console.log();
        } catch (err) {
          logger.error({ error: err }, 'Locales generate command failed');
          error(`Failed to generate locale data: ${(err as Error).message}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('add')
      .description('Add locales to configuration')
      .argument('<locales>', 'Comma-separated locale codes (e.g., de,fr,ja)')
      .action(async (localesArg: string) => {
        try {
          const config = await loadConfig();
          const newLocales = localesArg.split(',').map((l) => l.trim());
          const added: string[] = [];

          for (const locale of newLocales) {
            if (!config.locales.includes(locale)) {
              config.locales.push(locale);
              added.push(locale);
            }
          }

          if (added.length === 0) {
            info('All locales already configured');
            return;
          }

          await saveConfig(config);
          success(`Added ${added.length} locale(s): ${added.join(', ')}`);
          console.log();
          console.log('Run locale data generation:');
          console.log('  aperture locales generate');
        } catch (err) {
          logger.error({ error: err }, 'Locales add command failed');
          error(`Failed to add locales: ${(err as Error).message}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove locales from configuration')
      .argument('<locales>', 'Comma-separated locale codes')
      .action(async (localesArg: string) => {
        try {
          const config = await loadConfig();
          const toRemove = localesArg.split(',').map((l) => l.trim());
          const removed: string[] = [];

          for (const locale of toRemove) {
            const index = config.locales.indexOf(locale);
            if (index !== -1) {
              config.locales.splice(index, 1);
              removed.push(locale);
            }
          }

          if (removed.length === 0) {
            warning('No locales found to remove');
            return;
          }

          await saveConfig(config);
          success(`Removed ${removed.length} locale(s): ${removed.join(', ')}`);
        } catch (err) {
          logger.error({ error: err }, 'Locales remove command failed');
          error(`Failed to remove locales: ${(err as Error).message}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List known locale codes')
      .action(() => {
        console.log('Known locales:');
        console.log();
        KNOWN_LOCALES.forEach((l) => {
          console.log(`  ${l.code.padEnd(8)} ${l.displayName} ${l.region ? `(${l.region})` : ''}`);
        });
        console.log();
        console.log('You can also use any valid locale code.');
      })
  );
