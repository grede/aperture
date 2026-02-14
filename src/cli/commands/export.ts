import { readFile, readdir, mkdir, writeFile } from 'fs/promises';
import { resolve, join, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import YAML from 'yaml';
import { TemplateEngine } from '../../templates/engine.js';
import type { ApertureConfig, TemplateStyle } from '../../types/index.js';

interface ExportOptions {
  style?: TemplateStyle;
  locale?: string;
  device?: 'iphone' | 'ipad' | 'both';
}

interface LocaleCopy {
  [screenshotLabel: string]: {
    title: string;
    subtitle?: string;
  };
}

export async function exportCommand(options: ExportOptions): Promise<void> {
  console.log(chalk.bold.blue('\n📦 Aperture Export\n'));

  // Load config
  const configPath = resolve(process.cwd(), 'aperture.config.yaml');
  let config: ApertureConfig;

  try {
    const configContent = await readFile(configPath, 'utf-8');
    config = YAML.parse(configContent) as ApertureConfig;
  } catch (error) {
    console.error(chalk.red('Error loading config:'), error);
    process.exit(1);
  }

  const style = options.style ?? config.template.style;
  const locales = options.locale ? [options.locale] : config.locales;
  const devices = options.device === 'iphone'
    ? ['iphone' as const]
    : options.device === 'ipad'
    ? ['ipad' as const]
    : ['iphone' as const, 'ipad' as const];

  const templateEngine = new TemplateEngine();
  let totalExported = 0;
  let totalFailed = 0;

  // Process each locale and device
  for (const locale of locales) {
    for (const deviceType of devices) {
      console.log(chalk.bold(`\n${locale} - ${deviceType.toUpperCase()}`));

      const screenshotsDir = join(config.output, locale, deviceType);
      const exportDir = join(config.output, 'export', locale, deviceType);
      const copyPath = join(process.cwd(), 'locales', `${locale}-copy.yaml`);

      // Load marketing copy
      let localeCopy: LocaleCopy = {};
      try {
        const copyContent = await readFile(copyPath, 'utf-8');
        localeCopy = YAML.parse(copyContent) as LocaleCopy;
      } catch (error) {
        console.log(chalk.yellow(`  ⚠ No marketing copy found at ${copyPath}`));
        console.log(chalk.dim(`    Using screenshot labels as titles`));
      }

      // Create export directory
      await mkdir(exportDir, { recursive: true });

      // Find all screenshots
      try {
        const files = await readdir(screenshotsDir);
        const screenshots = files.filter((f) => f.endsWith('.png'));

        if (screenshots.length === 0) {
          console.log(chalk.yellow(`  ⚠ No screenshots found in ${screenshotsDir}`));
          continue;
        }

        const spinner = ora(`Exporting ${screenshots.length} screenshot(s)...`).start();

        for (const screenshot of screenshots) {
          const label = basename(screenshot, '.png');
          const screenshotPath = join(screenshotsDir, screenshot);

          try {
            // Get marketing copy or use label as fallback
            const copy = localeCopy[label] ?? {
              title: label.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              subtitle: '',
            };

            // Load screenshot
            const screenshotBuffer = await readFile(screenshotPath);

            // Composite with template
            const exportBuffer = await templateEngine.composite({
              screenshot: screenshotBuffer,
              style,
              deviceType: deviceType === 'iphone' ? 'iPhone' : 'iPad',
              title: copy.title,
              subtitle: copy.subtitle,
              locale,
            });

            // Save exported image
            const exportPath = join(exportDir, screenshot);
            await writeFile(exportPath, exportBuffer);

            totalExported++;
          } catch (error) {
            spinner.fail(`Failed to export ${screenshot}`);
            console.error(chalk.red(`    Error: ${error}`));
            totalFailed++;
          }
        }

        spinner.succeed(`Exported ${screenshots.length} screenshot(s) → ${exportDir}`);
      } catch (error) {
        console.log(chalk.yellow(`  ⚠ Could not read directory: ${screenshotsDir}`));
      }
    }
  }

  // Summary
  console.log(chalk.bold.green(`\n✓ Export complete!\n`));
  console.log(`  Exported: ${chalk.cyan(totalExported)} image(s)`);
  if (totalFailed > 0) {
    console.log(`  Failed: ${chalk.red(totalFailed)} image(s)`);
  }
  console.log(`  Style: ${chalk.cyan(style)}\n`);

  process.exit(totalFailed > 0 ? 1 : 0);
}
