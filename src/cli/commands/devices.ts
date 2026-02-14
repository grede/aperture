import chalk from 'chalk';
import { DeviceManager } from '../../core/device-manager.js';

interface DevicesOptions {
  booted?: boolean;
  json?: boolean;
}

export async function devicesCommand(options: DevicesOptions): Promise<void> {
  try {
    const deviceManager = new DeviceManager();
    const devices = await deviceManager.listDevices(options.booted ?? false);

    if (options.json) {
      console.log(JSON.stringify(devices, null, 2));
      return;
    }

    // Format as table
    console.log(
      chalk.bold('\nAvailable iOS Simulators:\n')
    );

    if (devices.length === 0) {
      console.log(chalk.yellow('No devices found.'));
      if (options.booted) {
        console.log(chalk.dim('Try running without --booted flag to see all devices.'));
      }
      return;
    }

    // Group by device type
    const iphones = devices.filter((d) => d.deviceType === 'iPhone');
    const ipads = devices.filter((d) => d.deviceType === 'iPad');

    if (iphones.length > 0) {
      console.log(chalk.bold.blue('📱 iPhones:'));
      iphones.forEach((device) => {
        const status = device.state === 'Booted' ? chalk.green('● Booted') : chalk.dim('○ Shutdown');
        console.log(`  ${status} ${device.name} ${chalk.dim(`(${device.runtime})`)}`);
        console.log(chalk.dim(`    UDID: ${device.udid}\n`));
      });
    }

    if (ipads.length > 0) {
      console.log(chalk.bold.blue('📱 iPads:'));
      ipads.forEach((device) => {
        const status = device.state === 'Booted' ? chalk.green('● Booted') : chalk.dim('○ Shutdown');
        console.log(`  ${status} ${device.name} ${chalk.dim(`(${device.runtime})`)}`);
        console.log(chalk.dim(`    UDID: ${device.udid}\n`));
      });
    }

    console.log(chalk.dim(`Total: ${devices.length} device(s)\n`));
  } catch (error) {
    console.error(chalk.red('Error listing devices:'), error);
    process.exit(1);
  }
}
