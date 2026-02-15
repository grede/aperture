import { readFile, readdir, mkdir, writeFile } from 'fs/promises';
import { resolve, join, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import YAML from 'yaml';
import { TemplateEngine } from '../../templates/engine.js';
import type {
  ApertureConfig,
  TemplateStyle,
  TemplateFrameMode,
  TemplateDeviceType,
} from '../../types/index.js';

interface ExportOptions {
  style?: TemplateStyle;
  locale?: string;
  device?: 'iphone' | 'ipad' | 'android' | 'both' | 'all';
  frame?: TemplateFrameMode;
  frameAssets?: string;
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
  const frameMode = options.frame ?? config.template.frame?.mode ?? 'minimal';
  const frameAssetsDir = options.frameAssets
    ? resolve(process.cwd(), options.frameAssets)
    : config.template.frame?.assetsDir
      ? resolve(process.cwd(), config.template.frame.assetsDir)
      : undefined;
  const locales = options.locale ? [options.locale] : config.locales;
  const devices = resolveExportDevices(options.device, config);

  const templateEngine = new TemplateEngine();
  let totalExported = 0;
  let totalFailed = 0;

  if (frameMode === 'realistic' && !frameAssetsDir) {
    console.log(chalk.yellow('  ⚠ Frame mode is realistic, but no frame assets directory is configured.'));
    console.log(chalk.dim('    Falling back to minimal generated frames where assets are missing.\n'));
  }

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
              deviceType: toTemplateDeviceType(deviceType),
              title: copy.title,
              subtitle: copy.subtitle,
              locale,
              frameMode,
              frameAssetsDir,
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
  console.log(`  Style: ${chalk.cyan(style)}`);
  console.log(`  Frame: ${chalk.cyan(frameMode)}\n`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

function resolveExportDevices(
  selection: ExportOptions['device'],
  config: ApertureConfig
): Array<'iphone' | 'ipad' | 'android'> {
  if (selection === 'iphone') return ['iphone'];
  if (selection === 'ipad') return ['ipad'];
  if (selection === 'android') return ['android'];
  if (selection === 'all') return ['iphone', 'ipad', 'android'];

  // Preserve previous default behavior while respecting optional iPad configuration.
  return config.devices.ipad ? ['iphone', 'ipad'] : ['iphone'];
}

function toTemplateDeviceType(device: 'iphone' | 'ipad' | 'android'): TemplateDeviceType {
  if (device === 'iphone') return 'iPhone';
  if (device === 'ipad') return 'iPad';
  return 'Android';
}
