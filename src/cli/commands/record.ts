import inquirer from 'inquirer';
import { deviceManager } from '../../core/device-manager.js';
import { connectToWDA } from '../../core/wda-connection.js';
import { Recorder } from '../../core/recorder.js';
import { loadConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { appiumManager } from '../../core/appium-manager.js';
import { success, error, warning, header, info, createSpinner } from '../ui.js';

/**
 * Record command options
 */
export interface RecordOptions {
  name?: string;
  device?: string;
  noAutoAppium?: boolean;
  appiumPort?: string;
}

/**
 * Record a manual walkthrough (US-003, US-004)
 */
export async function recordCommand(options: RecordOptions = {}) {
  try {
    header('Recording Mode');

    // Load config
    const config = await loadConfig();

    // Get recording name
    let recordingName = options.name;
    if (!recordingName) {
      const answer = await inquirer.prompt<{ name: string }>([
        {
          type: 'input',
          name: 'name',
          message: 'Recording name:',
          default: `recording-${Date.now()}`,
          validate: (input) => (input.length > 0 ? true : 'Name is required'),
        },
      ]);
      recordingName = answer.name;
    }

    // Get or select device
    let deviceUdid = options.device || config.simulators.iphone;
    if (!deviceUdid) {
      const bootedDevices = await deviceManager.getBootedDevices();

      if (bootedDevices.length === 0) {
        error('No booted Simulators found');
        console.log();
        console.log('Please boot a Simulator first:');
        console.log('  xcrun simctl boot <UDID>');
        console.log();
        console.log('Or run: aperture devices');
        process.exit(1);
      }

      const choices = bootedDevices.map((d) => ({
        name: `${d.name} (${d.version})`,
        value: d.udid,
      }));

      const answer = await inquirer.prompt<{ device: string }>([
        {
          type: 'list',
          name: 'device',
          message: 'Select Simulator:',
          choices,
        },
      ]);

      deviceUdid = answer.device;
    }

    const device = await deviceManager.getDevice(deviceUdid);

    // Boot device if not booted
    if (device.state !== 'Booted') {
      const spinner = createSpinner(`Booting ${device.name}...`).start();
      await deviceManager.bootDevice(device.udid);
      spinner.succeed(`${device.name} booted`);
    }

    // Install app if needed
    info(`App: ${config.app.path}`);
    const spinner = createSpinner('Installing app...').start();

    try {
      await deviceManager.installApp(device.udid, config.app.path);
      spinner.succeed('App installed');
    } catch (err) {
      spinner.warn('App may already be installed');
    }

    // Launch app
    if (!config.app.bundleId) {
      error('Bundle ID not found in config');
      process.exit(1);
    }

    const launchSpinner = createSpinner('Launching app...').start();
    await deviceManager.launchApp(device.udid, config.app.bundleId);
    launchSpinner.succeed('App launched');

    // Automatic Appium management (US-023)
    if (!options.noAutoAppium) {
      // Check if Appium is installed
      if (!(await appiumManager.isInstalled())) {
        console.log();
        warning('Appium is required for recording but not installed.');
        console.log();
        console.log('Appium is an automation framework for iOS apps.');
        console.log('Aperture can install it automatically.');
        console.log();

        const { shouldInstall } = await inquirer.prompt<{ shouldInstall: boolean }>([
          {
            type: 'confirm',
            name: 'shouldInstall',
            message: 'Install Appium automatically?',
            default: true,
          },
        ]);

        if (shouldInstall) {
          const installSpinner = createSpinner('Installing Appium...').start();
          try {
            await appiumManager.install((message) => {
              installSpinner.text = message;
            });
            installSpinner.succeed('Appium installed');
          } catch (err) {
            installSpinner.fail('Failed to install Appium');
            console.log();
            console.log('Manual installation:');
            console.log('  npm install --save-dev appium');
            console.log('  npx appium driver install xcuitest');
            console.log();
            process.exit(1);
          }
        } else {
          console.log();
          console.log('Manual installation required:');
          console.log('  npm install --save-dev appium');
          console.log('  npx appium driver install xcuitest');
          console.log();
          process.exit(1);
        }
      }

      // Ensure Appium server is running and healthy
      const port = options.appiumPort ? parseInt(options.appiumPort, 10) : undefined;
      const serverSpinner = createSpinner('Checking Appium server...').start();
      try {
        const processInfo = await appiumManager.ensureHealthy(port);
        serverSpinner.succeed(`Appium server running on port ${processInfo.port}`);
        info(`View logs: aperture server logs`);
      } catch (err) {
        serverSpinner.fail('Failed to start Appium server');
        logger.error('Appium start failed', { error: err });
        console.log();
        console.log('Manual recovery:');
        console.log('  1. Check logs: aperture server logs');
        console.log('  2. Try manual start: aperture server start');
        console.log('  3. Or use --no-auto-appium and start Appium manually');
        console.log();
        process.exit(1);
      }
    }

    // Connect to WebDriverAgent
    const wdaSpinner = createSpinner('Connecting to WebDriverAgent...').start();
    const wda = await connectToWDA(device, config.app.bundleId);
    wdaSpinner.succeed('Connected to WebDriverAgent');

    // Start recording
    const recorder = new Recorder();
    await recorder.startSession(recordingName, device, config.app.bundleId, wda);

    success(`Recording started: ${recordingName}`);
    console.log();
    console.log('Interactive Recording Mode:');
    console.log('  - Manually interact with your app');
    console.log('  - Return here to mark screenshot points');
    console.log('  - Type "screenshot <label>" to mark a screenshot point');
    console.log('  - Type "done" when finished');
    console.log();

    // Interactive recording loop
    let recording = true;
    while (recording) {
      const answer = await inquirer.prompt<{ command: string }>([
        {
          type: 'input',
          name: 'command',
          message: '>',
        },
      ]);

      const command = answer.command.trim().toLowerCase();

      if (command === 'done') {
        recording = false;
      } else if (command.startsWith('screenshot ')) {
        const label = command.substring('screenshot '.length).trim();
        if (label) {
          await recorder.markScreenshot(label);
          success(`Screenshot point marked: ${label}`);
        } else {
          warning('Please provide a label: screenshot <label>');
        }
      } else if (command === 'help') {
        console.log('Available commands:');
        console.log('  screenshot <label> - Mark a screenshot point');
        console.log('  done              - Stop recording and save');
        console.log('  help              - Show this help');
      } else if (command) {
        warning(`Unknown command: ${command}. Type "help" for available commands.`);
      }
    }

    // Stop recording
    const finalSpinner = createSpinner('Saving recording...').start();
    const finalRecording = await recorder.stopSession();
    finalSpinner.succeed('Recording saved');

    // Cleanup
    await wda.disconnect();

    console.log();
    success('Recording completed! 🎉');
    console.log();
    console.log('Summary:');
    console.log(`  Name: ${finalRecording.name}`);
    console.log(`  Steps: ${finalRecording.steps.length}`);
    console.log(`  Screenshots: ${finalRecording.screenshotPoints.length}`);
    console.log();
    console.log('Next steps:');
    console.log(`  aperture play ${finalRecording.name}`);
    console.log();
  } catch (err) {
    logger.error({ error: err }, 'Record command failed');
    error(`Failed to record: ${(err as Error).message}`);
    process.exit(1);
  }
}
