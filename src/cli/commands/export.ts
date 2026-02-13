import { loadConfig } from '../../config/index.js';
import { templateEngine } from '../../templates/template-engine.js';
import type { TemplateStyleName, DeviceTarget } from '../../types/export.js';
import { logger } from '../../utils/logger.js';
import { error, success, header, info, createSpinner } from '../ui.js';

/**
 * Export command options
 */
export interface ExportOptions {
  style?: TemplateStyleName;
  locales?: string;
  devices?: string;
  outputDir?: string;
}

/**
 * Export command: Apply device frame templates to screenshots (US-017)
 */
export async function exportCommand(templateName: string, options: ExportOptions = {}) {
  try {
    header('Export Screenshots with Templates');

    // Load config
    const config = await loadConfig();

    // Determine style
    const styleName = (options.style || 'modern') as TemplateStyleName;

    // Validate style exists
    const availableStyles = await templateEngine.listStyles();
    if (!availableStyles.includes(styleName)) {
      error(`Style "${styleName}" not found`);
      console.log();
      console.log('Available styles:');
      availableStyles.forEach((s) => console.log(`  - ${s}`));
      process.exit(1);
    }

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

    // Determine target devices (US-019)
    let targetDevices: DeviceTarget[];
    if (options.devices === 'all') {
      targetDevices = ['iphone', 'ipad'];
    } else if (options.devices) {
      targetDevices = options.devices.split(',').map((d) => d.trim() as DeviceTarget);
    } else {
      // Default to both iPhone and iPad
      targetDevices = ['iphone', 'ipad'];
    }

    info(`Template: ${templateName}`);
    info(`Style: ${styleName}`);
    info(`Locales: ${targetLocales.join(', ')}`);
    info(`Devices: ${targetDevices.join(', ')}`);
    info(`Output directory: ${options.outputDir || config.outputDir}`);
    console.log();

    // Start export
    const exportSpinner = createSpinner('Exporting screenshots...').start();

    const result = await templateEngine.exportAll({
      templateName,
      styleName,
      locales: targetLocales,
      devices: targetDevices,
      outputDir: options.outputDir || config.outputDir,
    });

    exportSpinner.stop();

    // Display results
    console.log();
    if (result.failureCount === 0) {
      success('Export completed successfully! 🎉');
    } else {
      error(`Export completed with ${result.failureCount} failure(s)`);
    }

    console.log();
    console.log('Summary:');
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`  Screenshots: ${result.successCount}/${result.screenshots.length} succeeded`);
    console.log();

    // Show per-locale results
    console.log('Per-locale results:');
    for (const locale of targetLocales) {
      const localeResults = result.screenshots.filter((r) => r.locale === locale);
      const localeSuccessCount = localeResults.filter((r) => r.success).length;
      console.log(`  ${locale}: ${localeSuccessCount}/${localeResults.length} screenshots`);
    }
    console.log();

    if (result.failureCount > 0) {
      console.log('Failed screenshots:');
      result.screenshots
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  ${r.locale}/${r.device}/${r.label}: ${r.error}`);
        });
      console.log();
      process.exit(1);
    } else {
      console.log('Output directory:');
      console.log(`  ${options.outputDir || config.outputDir}/export/`);
      console.log();
    }
  } catch (err) {
    logger.error({ error: err }, 'Export command failed');
    error(`Failed to export template: ${(err as Error).message}`);
    process.exit(1);
  }
}
