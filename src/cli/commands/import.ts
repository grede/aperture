import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import { loadConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { error, success, header, info, createSpinner } from '../ui.js';
import type { BaseScreenshotCopy } from '../../translations/translation-service.js';

/**
 * Import command options
 */
export interface ImportOptions {
  name?: string;
  outputDir?: string;
}

/**
 * Screenshot import metadata
 */
interface ImportedScreenshot {
  /** Original file path */
  sourcePath: string;
  /** Screenshot label */
  label: string;
  /** Destination path in output directory */
  destPath: string;
}

/**
 * Import existing screenshots (US-022)
 */
export async function importCommand(screenshotsDir: string, options: ImportOptions = {}) {
  try {
    header('Import Existing Screenshots');

    // Load config
    const config = await loadConfig();

    // Verify screenshots directory exists
    try {
      await fs.access(screenshotsDir);
    } catch {
      error(`Directory not found: ${screenshotsDir}`);
      process.exit(1);
    }

    // Get import name
    let importName = options.name;
    if (!importName) {
      const { name } = await inquirer.prompt<{ name: string }>([
        {
          type: 'input',
          name: 'name',
          message: 'Import name (used for organizing files):',
          default: 'imported',
          validate: (input: string) => (input.trim().length > 0 ? true : 'Name is required'),
        },
      ]);
      importName = name;
    }

    // Find all PNG files in directory
    const spinner = createSpinner('Scanning for PNG files...').start();
    const files = await fs.readdir(screenshotsDir);
    const pngFiles = files.filter((f) => f.toLowerCase().endsWith('.png')).sort();

    if (pngFiles.length === 0) {
      spinner.fail('No PNG files found');
      error(`No screenshots found in: ${screenshotsDir}`);
      process.exit(1);
    }

    spinner.succeed(`Found ${pngFiles.length} screenshot(s)`);
    console.log();

    // Prompt for label and copy for each screenshot
    const importedScreenshots: ImportedScreenshot[] = [];
    const baseCopy: BaseScreenshotCopy[] = [];

    info('For each screenshot, provide a label and marketing copy');
    console.log();

    for (let i = 0; i < pngFiles.length; i++) {
      const file = pngFiles[i];
      const sourcePath = path.join(screenshotsDir, file);

      console.log(`Screenshot ${i + 1}/${pngFiles.length}: ${file}`);

      const answers = await inquirer.prompt<{
        label: string;
        title: string;
        subtitle?: string;
        hasSubtitle: boolean;
      }>([
        {
          type: 'input',
          name: 'label',
          message: 'Label (e.g., "chat", "settings"):',
          default: path.basename(file, '.png'),
          validate: (input: string) => {
            if (input.trim().length === 0) {
              return 'Label is required';
            }
            // Check for duplicates
            if (importedScreenshots.some((s) => s.label === input.trim())) {
              return 'Label must be unique';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'title',
          message: 'Title (marketing headline):',
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
          message: 'Subtitle:',
          when: (answers) => answers.hasSubtitle,
        },
      ]);

      const label = answers.label.trim();
      const destPath = path.join(
        options.outputDir || config.outputDir,
        importName,
        'en', // Default to English locale for imported screenshots
        `${label}.png`
      );

      importedScreenshots.push({
        sourcePath,
        label,
        destPath,
      });

      baseCopy.push({
        label,
        title: answers.title,
        subtitle: answers.subtitle,
      });

      console.log();
    }

    // Confirm import
    console.log();
    header('Import Summary');
    info(`Import name: ${importName}`);
    info(`Screenshots: ${importedScreenshots.length}`);
    info(`Output directory: ${options.outputDir || config.outputDir}`);
    console.log();

    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed with import?',
        default: true,
      },
    ]);

    if (!confirm) {
      error('Import cancelled');
      process.exit(0);
    }

    // Copy screenshots to output directory
    const copySpinner = createSpinner('Copying screenshots...').start();

    for (const screenshot of importedScreenshots) {
      await fs.mkdir(path.dirname(screenshot.destPath), { recursive: true });
      await fs.copyFile(screenshot.sourcePath, screenshot.destPath);
    }

    copySpinner.succeed('Screenshots copied');

    // Save import metadata
    const metadataPath = path.join(
      options.outputDir || config.outputDir,
      importName,
      'import-metadata.json'
    );

    const metadata = {
      importName,
      importedAt: new Date().toISOString(),
      sourceDir: screenshotsDir,
      screenshots: importedScreenshots.map((s) => ({
        label: s.label,
        sourcePath: s.sourcePath,
        destPath: s.destPath,
      })),
      baseCopy,
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    logger.info({ importName, screenshotCount: importedScreenshots.length }, 'Screenshots imported');

    // Display success and next steps
    console.log();
    success('Import completed successfully! 🎉');
    console.log();
    console.log('Imported screenshots:');
    for (const screenshot of importedScreenshots) {
      console.log(`  ${screenshot.label} → ${screenshot.destPath}`);
    }
    console.log();
    console.log('Next steps:');
    console.log(`  1. Generate translations: aperture translations generate`);
    console.log(`  2. Export with templates: aperture export ${importName} --style modern`);
    console.log();
  } catch (err) {
    logger.error({ error: err }, 'Import command failed');
    error(`Failed to import screenshots: ${(err as Error).message}`);
    process.exit(1);
  }
}
