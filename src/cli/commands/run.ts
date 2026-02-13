import { loadConfig } from '../../config/index.js';
import { parameterizer } from '../../core/parameterizer.js';
import { localeDataGenerator } from '../../core/locale-data-generator.js';
import { localeManager } from '../../core/locale-manager.js';
import { deviceManager } from '../../core/device-manager.js';
import { connectToWDA } from '../../core/wda-connection.js';
import { Player } from '../../core/player.js';
import { appiumManager } from '../../core/appium-manager.js';
import { logger } from '../../utils/logger.js';
import { error, success, warning, header, info, createSpinner } from '../ui.js';
import type { Recording, Step } from '../../types/recording.js';
import type { LocaleData } from '../../types/locale.js';

interface RunOptions {
  locales?: string;
  device?: string;
  outputDir?: string;
  noAutoAppium?: boolean;
  appiumPort?: number;
}

/**
 * Run command: Batch execution across all locales (US-014)
 */
export async function runCommand(templateName: string, options: RunOptions) {
  try {
    header('Multi-Locale Playback');

    // Load config
    const config = await loadConfig();

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

    info(`Template: ${templateName}`);
    info(`Target locales: ${targetLocales.join(', ')}`);
    info(`Output directory: ${options.outputDir || config.outputDir}`);
    console.log();

    // Load template
    const template = await parameterizer.loadTemplate(templateName);

    // Ensure Appium is running
    const port = options.appiumPort || 8100;
    if (!options.noAutoAppium) {
      const appiumSpinner = createSpinner('Checking Appium server...').start();
      if (!(await appiumManager.isInstalled())) {
        appiumSpinner.fail('Appium is not installed');
        error('Please run: aperture server install');
        process.exit(1);
      }

      const processInfo = await appiumManager.ensureHealthy(port);
      appiumSpinner.succeed(`Appium server running on port ${processInfo.port}`);
    }

    // Get device UDID
    let udid = options.device || config.simulators.iphone;

    if (!udid) {
      const bootedDevices = await deviceManager.listDevices(true);
      if (bootedDevices.length === 0) {
        error('No booted Simulators found');
        console.log();
        console.log('Boot a Simulator or specify UDID:');
        console.log('  aperture run <template> --device <udid>');
        process.exit(1);
      }
      udid = bootedDevices[0].udid;
    }

    const device = await deviceManager.getDevice(udid);

    info(`Using Simulator: ${device.name} (${udid})`);
    console.log();

    // Run for each locale
    const results: { locale: string; success: boolean; screenshotCount?: number; error?: string }[] = [];

    for (let i = 0; i < targetLocales.length; i++) {
      const locale = targetLocales[i];
      const progress = `[${i + 1}/${targetLocales.length}]`;

      const localeSpinner = createSpinner(`${progress} Running locale: ${locale}...`).start();

      try {
        // Load locale data
        const localeData = await localeDataGenerator.loadLocaleData(locale);
        if (!localeData) {
          localeSpinner.fail(`${progress} ${locale}: No locale data found`);
          results.push({ locale, success: false, error: 'No locale data found' });
          continue;
        }

        // Validate locale data against template
        if (localeData.templateHash !== template.recordingHash) {
          localeSpinner.warn(`${progress} ${locale}: Locale data out of date`);
          warning(`Run 'aperture locales generate --template ${templateName}' to regenerate`);
          results.push({ locale, success: false, error: 'Locale data out of date' });
          continue;
        }

        // Substitute parameters in recording
        const localizedRecording = substituteParameters(template.recording, localeData);

        // Switch Simulator locale
        localeSpinner.text = `${progress} ${locale}: Switching Simulator locale...`;
        await localeManager.setLocale(udid, locale);
        await localeManager.rebootSimulator(udid);

        // Reset app
        localeSpinner.text = `${progress} ${locale}: Resetting app...`;
        const bundleId = template.recording.bundleId || config.app.bundleId;
        if (!bundleId) {
          throw new Error('Bundle ID not found in template or config');
        }
        await deviceManager.resetApp(udid, bundleId, config.app.path);

        // Connect to WebDriverAgent
        localeSpinner.text = `${progress} ${locale}: Connecting to WebDriverAgent...`;
        const wda = await connectToWDA(device, bundleId);

        // Replay recording
        localeSpinner.text = `${progress} ${locale}: Replaying recording...`;
        const player = new Player(wda, udid, {
          outputDir: options.outputDir || config.outputDir,
          hideStatusBar: true,
          stepTimeout: config.guardrails.stepTimeout,
          stepRetries: config.guardrails.stepRetries,
          maxSteps: config.guardrails.maxSteps,
          runTimeout: config.guardrails.runTimeout,
          forbiddenActions: config.guardrails.forbiddenActions,
        });

        const playbackResult = await player.replay(localizedRecording, locale);

        // Cleanup
        await wda.disconnect();

        const screenshotCount = playbackResult.screenshots.length;
        localeSpinner.succeed(`${progress} ${locale}: ✓ (${screenshotCount} screenshots captured)`);

        results.push({ locale, success: true, screenshotCount });

        logger.info({ locale, screenshotCount }, 'Locale playback completed');
      } catch (err) {
        const errorMessage = (err as Error).message;
        localeSpinner.fail(`${progress} ${locale}: ✗ ${errorMessage}`);
        results.push({ locale, success: false, error: errorMessage });
        logger.error({ locale, error: err }, 'Locale playback failed');

        // Continue with remaining locales (US-014: failed locales don't block others)
        continue;
      }
    }

    // Display summary report
    console.log();
    header('Summary Report');
    console.log();

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const totalScreenshots = results.reduce((sum, r) => sum + (r.screenshotCount || 0), 0);

    console.log(`Total locales: ${results.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total screenshots: ${totalScreenshots}`);
    console.log();

    // Show detailed results
    console.log('Per-locale results:');
    for (const result of results) {
      if (result.success) {
        console.log(`  ✓ ${result.locale}: ${result.screenshotCount} screenshots`);
      } else {
        console.log(`  ✗ ${result.locale}: ${result.error}`);
      }
    }
    console.log();

    if (successCount === results.length) {
      success('All locales completed successfully! 🎉');
      console.log();
      console.log('Next steps:');
      console.log(`  aperture export ${templateName} --style modern`);
    } else if (successCount > 0) {
      warning(`${failCount} locale(s) failed`);
      console.log();
      console.log('Check the logs for details:');
      console.log('  tail -f logs/aperture.log');
    } else {
      error('All locales failed');
      process.exit(1);
    }
  } catch (err) {
    logger.error({ error: err }, 'Run command failed');
    error(`Failed to run template: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Substitute {{parameter}} placeholders with locale-specific values
 */
function substituteParameters(recording: Recording, localeData: LocaleData): Recording {
  const localizedRecording: Recording = {
    ...recording,
    steps: recording.steps.map((step) => {
      if (step.action === 'type' && step.value) {
        // Replace {{parameter}} with actual value
        const substituted = step.value.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
          const value = localeData.parameters[paramName];
          if (value === undefined) {
            logger.warn({ paramName, locale: localeData.locale }, 'Parameter not found in locale data');
            return match; // Keep placeholder if value not found
          }
          return value;
        });

        return { ...step, value: substituted } as Step;
      }
      return step;
    }),
  };

  return localizedRecording;
}
