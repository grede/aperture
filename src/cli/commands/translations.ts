import { Command } from 'commander';
import { loadConfig } from '../../config/index.js';
import { translationService, TranslationService, type BaseScreenshotCopy } from '../../translations/translation-service.js';
import { aiClient } from '../../utils/ai-client.js';
import { logger } from '../../utils/logger.js';
import { error, success, warning, header, info, createSpinner } from '../ui.js';
import inquirer from 'inquirer';

/**
 * Translations command group (US-018)
 */
export const translationsCommand = new Command('translations')
  .description('Manage localized marketing copy for screenshots')
  .addCommand(
    new Command('generate')
      .description('Generate marketing copy for all locales (US-018)')
      .option('--force', 'Regenerate even if translations exist')
      .option('--locales <locales>', 'Comma-separated locale list or "all" (default: all configured)')
      .action(async (options) => {
        await generateTranslations(options);
      })
  );

/**
 * Generate localized marketing copy for screenshots (US-018)
 */
async function generateTranslations(options: { force?: boolean; locales?: string }) {
  try {
    header('Generate Localized Marketing Copy');

    // Load config
    const config = await loadConfig();

    // Initialize AI client
    if (!config.openai?.apiKey) {
      error('OpenAI API key not configured');
      console.log();
      console.log('Add your API key to aperture.config.json:');
      console.log('  {');
      console.log('    "openai": {');
      console.log('      "apiKey": "sk-..."');
      console.log('    }');
      console.log('  }');
      process.exit(1);
    }

    aiClient.initialize({
      apiKey: config.openai.apiKey,
      model: config.openai.model,
      fallbackModel: config.openai.fallbackModel,
      maxTokens: config.openai.maxTokens,
    });

    // Determine target locales
    let targetLocales: string[];
    if (options.locales === 'all') {
      targetLocales = config.locales;
    } else if (options.locales) {
      targetLocales = options.locales.split(',').map((l) => l.trim());
    } else {
      targetLocales = config.locales;
    }

    if (targetLocales.length === 0) {
      error('No locales configured');
      console.log();
      console.log('Add locales to your configuration:');
      console.log('  aperture locales add en,de,fr');
      process.exit(1);
    }

    // Check if English copy already exists
    const existingEnglish = await translationService.loadTranslations('en');
    let baseCopy: BaseScreenshotCopy[];

    if (existingEnglish && !options.force) {
      // Use existing English copy
      info('Using existing English copy');
      baseCopy = Object.entries(existingEnglish.copy).map(([label, copy]) => ({
        label,
        title: copy.title,
        subtitle: copy.subtitle,
      }));
    } else {
      // Prompt user for base English copy
      console.log();
      console.log('Enter marketing copy for each screenshot.');
      console.log('This will be used as the base for all locales.');
      console.log();

      // Prompt for number of screenshots
      const { screenshotCount } = await inquirer.prompt<{ screenshotCount: string }>([
        {
          type: 'input',
          name: 'screenshotCount',
          message: 'How many screenshots do you want to create copy for?',
          default: '5',
          validate: (input: string) => {
            const num = parseInt(input, 10);
            if (isNaN(num) || num < 1 || num > 10) {
              return 'Please enter a number between 1 and 10';
            }
            return true;
          },
        },
      ]);

      const count = parseInt(screenshotCount, 10);
      baseCopy = [];

      // Prompt for copy for each screenshot
      for (let i = 1; i <= count; i++) {
        console.log();
        console.log(`Screenshot ${i}/${count}:`);

        const answers = await inquirer.prompt<{
          label: string;
          title: string;
          subtitle?: string;
          hasSubtitle: boolean;
        }>([
          {
            type: 'input',
            name: 'label',
            message: 'Screenshot label (e.g., "onboarding-1", "chat"):',
            default: `screenshot-${i}`,
          },
          {
            type: 'input',
            name: 'title',
            message: 'Title (main headline):',
            validate: (input: string) => (input.trim().length > 0 ? true : 'Title is required'),
          },
          {
            type: 'confirm',
            name: 'hasSubtitle',
            message: 'Add subtitle?',
            default: false,
          },
          {
            type: 'input',
            name: 'subtitle',
            message: 'Subtitle (optional):',
            when: (answers) => answers.hasSubtitle,
          },
        ]);

        baseCopy.push({
          label: answers.label,
          title: answers.title,
          subtitle: answers.subtitle,
        });
      }
    }

    // Show summary
    console.log();
    info(`Locales: ${targetLocales.join(', ')}`);
    info(`Screenshots: ${baseCopy.length}`);
    if (options.force) {
      warning('Force mode: Existing translations will be overwritten');
    }
    console.log();

    // Compute template hash
    const templateHash = TranslationService.hashBaseCopy(baseCopy);

    // Generate translations
    const spinner = createSpinner('Generating translations...').start();

    const results = await translationService.generateAll(
      baseCopy,
      targetLocales,
      templateHash,
      options.force || false
    );

    spinner.succeed('Translations generated');

    // Display results
    console.log();
    success('Translation generation completed! 🎉');
    console.log();
    console.log('Summary:');
    console.log(`  Locales: ${results.size}`);
    console.log(`  Screenshots: ${baseCopy.length}`);
    console.log(`  Total items: ${results.size * baseCopy.length}`);
    console.log();

    console.log('Per-locale results:');
    for (const [locale, translations] of results.entries()) {
      const copyCount = Object.keys(translations.copy).length;
      console.log(`  ${locale}: ${copyCount} screenshots`);
    }
    console.log();

    console.log('Translations saved to:');
    console.log('  ./translations/<locale>.json');
    console.log();
    console.log('You can manually edit these files to refine the marketing copy.');
    console.log();
  } catch (err) {
    logger.error({ error: err }, 'Translations command failed');
    error(`Failed to generate translations: ${(err as Error).message}`);
    process.exit(1);
  }
}

