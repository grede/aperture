import { deviceManager } from '../../core/device-manager.js';
import { logger } from '../../utils/logger.js';
import { header, success, error, keyValue } from '../ui.js';

/**
 * List available iOS Simulators (US-001)
 * Default: booted devices only. Use --all to show all devices.
 */
export async function devicesCommand(options: { all?: boolean; json?: boolean } = {}) {
  try {
    // Default to booted only unless --all is specified
    const bootedOnly = !options.all;
    const devices = await deviceManager.listDevices(bootedOnly);

    if (options.json) {
      console.log(JSON.stringify(devices, null, 2));
      return;
    }

    if (devices.length === 0) {
      error(bootedOnly ? 'No booted iOS Simulators found' : 'No iOS Simulators found');
      console.log();
      if (bootedOnly) {
        console.log('No Simulators are currently running. To see all available devices:');
        console.log('  aperture devices --all');
      } else {
        console.log('Make sure Xcode is installed and Simulators are available:');
        console.log('  xcrun simctl list devices');
      }
      return;
    }

    header(`iOS Simulators ${options.all ? '(All)' : '(Booted)'}`);
    console.log();

    // Group by device type
    const iPhones = devices.filter((d) => d.deviceType === 'iPhone');
    const iPads = devices.filter((d) => d.deviceType === 'iPad');

    if (iPhones.length > 0) {
      console.log('iPhones:');
      for (const device of iPhones) {
        const status = device.state === 'Booted' ? '✓ Booted' : `${device.state}`;
        console.log(`  ${device.name} (iOS ${device.version})`);
        keyValue('  UDID', device.udid, 1);
        keyValue('  Status', status, 1);
        console.log();
      }
    }

    if (iPads.length > 0) {
      console.log('iPads:');
      for (const device of iPads) {
        const status = device.state === 'Booted' ? '✓ Booted' : `${device.state}`;
        console.log(`  ${device.name} (iOS ${device.version})`);
        keyValue('  UDID', device.udid, 1);
        keyValue('  Status', status, 1);
        console.log();
      }
    }

    success(`Found ${devices.length} device(s)`);
  } catch (err) {
    logger.error({ error: err }, 'Devices command failed');
    error(`Failed to list devices: ${(err as Error).message}`);
    process.exit(1);
  }
}
