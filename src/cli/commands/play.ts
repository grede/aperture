import { deviceManager } from '../../core/device-manager.js';
import { connectToWDA } from '../../core/wda-connection.js';
import { Recorder } from '../../core/recorder.js';
import { Player } from '../../core/player.js';
import { loadConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { success, error, header, info, createSpinner } from '../ui.js';

/**
 * Play command options
 */
export interface PlayOptions {
  device?: string;
  locale?: string;
  outputDir?: string;
}

/**
 * Replay a recording (US-005, US-006)
 */
export async function playCommand(recordingName: string, options: PlayOptions = {}) {
  try {
    header('Playback Mode');

    // Load config and recording
    const config = await loadConfig();
    const recorder = new Recorder();
    const recording = await recorder.loadRecording(recordingName);

    info(`Recording: ${recording.name}`);
    info(`Steps: ${recording.steps.length}`);
    info(`Screenshots: ${recording.screenshotPoints.length}`);

    // Get device
    const deviceUdid = options.device || config.simulators.iphone || recording.device?.udid;
    if (!deviceUdid) {
      error('No device specified. Use --device or configure in aperture.config.json');
      process.exit(1);
    }

    const device = await deviceManager.getDevice(deviceUdid);

    // Boot device if needed
    if (device.state !== 'Booted') {
      const spinner = createSpinner(`Booting ${device.name}...`).start();
      await deviceManager.bootDevice(device.udid);
      spinner.succeed(`${device.name} booted`);
    }

    // Reset app state
    const resetSpinner = createSpinner('Resetting app state...').start();
    await deviceManager.resetApp(device.udid, recording.bundleId, config.app.path);
    resetSpinner.succeed('App reset');

    // Connect to WebDriverAgent
    const wdaSpinner = createSpinner('Connecting to WebDriverAgent...').start();
    const wda = await connectToWDA(device, recording.bundleId);
    wdaSpinner.succeed('Connected to WebDriverAgent');

    // Create player
    const player = new Player(wda, device.udid, {
      stepTimeout: config.guardrails.stepTimeout,
      stepRetries: config.guardrails.stepRetries,
      outputDir: options.outputDir || config.outputDir,
      hideStatusBar: true,
    });

    // Start playback
    console.log();
    const playSpinner = createSpinner('Starting playback...').start();
    playSpinner.stop();

    const result = await player.replay(recording, options.locale);

    // Cleanup
    await wda.disconnect();

    // Display results
    console.log();
    if (result.failureCount === 0) {
      success('Playback completed successfully! 🎉');
    } else {
      error(`Playback completed with ${result.failureCount} failure(s)`);
    }

    console.log();
    console.log('Summary:');
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`  Steps: ${result.successCount}/${result.steps.length} succeeded`);
    console.log(`  Screenshots: ${result.screenshots.length} captured`);
    if (result.aiFallbackCount > 0) {
      console.log(`  AI Fallbacks: ${result.aiFallbackCount}`);
    }

    console.log();
    console.log('Output directory:');
    console.log(`  ${options.outputDir || config.outputDir}/${recording.name}`);
    console.log();

    if (result.failureCount > 0) {
      console.log('Failed steps:');
      result.steps
        .filter((s) => s.status === 'failed')
        .forEach((s) => {
          console.log(`  Step ${s.stepIndex}: ${s.error}`);
        });
      console.log();
      process.exit(1);
    }
  } catch (err) {
    logger.error({ error: err }, 'Play command failed');
    error(`Failed to play recording: ${(err as Error).message}`);
    process.exit(1);
  }
}
