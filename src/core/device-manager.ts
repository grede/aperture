import path from 'path';
import fs from 'fs/promises';
import {
  type SimulatorDevice,
  type DeviceState,
  type DeviceType,
  type BootStatus,
  type AppInfo,
  type SimctlDeviceList,
  DeviceError,
} from '../types/index.js';
import { simctl, xcrun } from '../utils/exec.js';
import { retryUntil, sleep } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

/**
 * Manages iOS Simulator lifecycle and WebDriverAgent connections
 */
export class DeviceManager {
  /**
   * List all available iOS Simulators
   */
  async listDevices(bootedOnly = false): Promise<SimulatorDevice[]> {
    logger.debug({ bootedOnly }, 'Listing devices');

    const result = await simctl(['list', 'devices', '-j']);

    if (result.exitCode !== 0) {
      throw new DeviceError('Failed to list devices', 'DEVICE_NOT_FOUND', {
        stderr: result.stderr,
      });
    }

    const deviceList: SimctlDeviceList = JSON.parse(result.stdout);
    const devices: SimulatorDevice[] = [];

    // Parse devices from each runtime
    for (const [runtime, runtimeDevices] of Object.entries(deviceList.devices)) {
      // Extract iOS version from runtime string (e.g., "iOS 17.2")
      const versionMatch = runtime.match(/iOS (\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      for (const device of runtimeDevices) {
        // Filter by boot status if requested
        if (bootedOnly && device.state !== 'Booted') {
          continue;
        }

        devices.push({
          udid: device.udid,
          name: device.name,
          version,
          state: device.state,
          deviceType: this.detectDeviceType(device.name),
          isAvailable: device.isAvailable,
        });
      }
    }

    logger.info({ count: devices.length, bootedOnly }, 'Listed devices');
    return devices;
  }

  /**
   * Get a specific device by UDID
   */
  async getDevice(udid: string): Promise<SimulatorDevice> {
    const devices = await this.listDevices();
    const device = devices.find((d) => d.udid === udid);

    if (!device) {
      throw new DeviceError(`Device not found: ${udid}`, 'DEVICE_NOT_FOUND', { udid });
    }

    return device;
  }

  /**
   * Get all booted devices
   */
  async getBootedDevices(): Promise<SimulatorDevice[]> {
    return this.listDevices(true);
  }

  /**
   * Boot a Simulator
   */
  async bootDevice(udid: string, timeout = 60000): Promise<void> {
    logger.info({ udid }, 'Booting device');

    const device = await this.getDevice(udid);

    // If already booted, nothing to do
    if (device.state === 'Booted') {
      logger.debug({ udid }, 'Device already booted');
      return;
    }

    // If booting, wait for it
    if (device.state === 'Booting') {
      logger.debug({ udid }, 'Device is booting, waiting...');
      await this.waitForBoot(udid, timeout);
      return;
    }

    // Boot the device
    const result = await simctl(['boot', udid]);

    if (result.exitCode !== 0) {
      throw new DeviceError(`Failed to boot device: ${udid}`, 'DEVICE_BOOT_TIMEOUT', {
        udid,
        stderr: result.stderr,
      });
    }

    // Wait for boot to complete
    await this.waitForBoot(udid, timeout);

    logger.info({ udid }, 'Device booted successfully');
  }

  /**
   * Wait for a device to finish booting
   */
  async waitForBoot(udid: string, timeout = 60000): Promise<void> {
    logger.debug({ udid, timeout }, 'Waiting for device to boot');

    try {
      await retryUntil(
        async () => {
          const device = await this.getDevice(udid);
          return device.state;
        },
        (state) => state === 'Booted',
        {
          timeout,
          interval: 1000,
          timeoutMessage: `Device boot timed out after ${timeout}ms`,
        }
      );
    } catch (error) {
      throw new DeviceError(
        `Device failed to boot within ${timeout}ms`,
        'DEVICE_BOOT_TIMEOUT',
        {
          udid,
          timeout,
          error,
        }
      );
    }

    // Additional wait for system to stabilize
    await sleep(2000);
  }

  /**
   * Shutdown a Simulator
   */
  async shutdownDevice(udid: string): Promise<void> {
    logger.info({ udid }, 'Shutting down device');

    const device = await this.getDevice(udid);

    if (device.state === 'Shutdown') {
      logger.debug({ udid }, 'Device already shut down');
      return;
    }

    const result = await simctl(['shutdown', udid]);

    if (result.exitCode !== 0 && !result.stderr.includes('Unable to shutdown')) {
      throw new DeviceError(`Failed to shutdown device: ${udid}`, 'DEVICE_NOT_FOUND', {
        udid,
        stderr: result.stderr,
      });
    }

    // Wait for shutdown
    await retryUntil(
      async () => {
        const d = await this.getDevice(udid);
        return d.state;
      },
      (state) => state === 'Shutdown',
      {
        timeout: 30000,
        interval: 500,
        timeoutMessage: 'Device shutdown timed out',
      }
    );

    logger.info({ udid }, 'Device shut down successfully');
  }

  /**
   * Install app on Simulator (US-002)
   */
  async installApp(udid: string, appPath: string): Promise<AppInfo> {
    logger.info({ udid, appPath }, 'Installing app');

    // Verify app bundle exists
    try {
      await fs.access(appPath);
    } catch {
      throw new DeviceError(`App bundle not found: ${appPath}`, 'APP_INSTALL_FAILED', {
        appPath,
      });
    }

    // Handle .ipa files - extract the .app bundle
    let actualAppPath = appPath;
    if (appPath.endsWith('.ipa')) {
      actualAppPath = await this.extractIpaBundle(appPath);
    }

    // Get bundle ID
    const bundleId = await this.getBundleId(actualAppPath);

    // Install the app
    const result = await simctl(['install', udid, actualAppPath]);

    if (result.exitCode !== 0) {
      throw new DeviceError(`Failed to install app: ${appPath}`, 'APP_INSTALL_FAILED', {
        udid,
        appPath,
        stderr: result.stderr,
      });
    }

    logger.info({ udid, bundleId }, 'App installed successfully');

    return {
      bundleId,
      name: path.basename(actualAppPath, '.app'),
      path: actualAppPath,
    };
  }

  /**
   * Uninstall app from Simulator
   */
  async uninstallApp(udid: string, bundleId: string): Promise<void> {
    logger.info({ udid, bundleId }, 'Uninstalling app');

    const result = await simctl(['uninstall', udid, bundleId]);

    if (result.exitCode !== 0 && !result.stderr.includes('No such file or directory')) {
      throw new DeviceError(`Failed to uninstall app: ${bundleId}`, 'APP_INSTALL_FAILED', {
        udid,
        bundleId,
        stderr: result.stderr,
      });
    }

    logger.info({ udid, bundleId }, 'App uninstalled successfully');
  }

  /**
   * Launch app on Simulator
   */
  async launchApp(udid: string, bundleId: string): Promise<void> {
    logger.info({ udid, bundleId }, 'Launching app');

    const result = await simctl(['launch', udid, bundleId]);

    if (result.exitCode !== 0) {
      throw new DeviceError(`Failed to launch app: ${bundleId}`, 'APP_LAUNCH_FAILED', {
        udid,
        bundleId,
        stderr: result.stderr,
      });
    }

    // Wait for app to start
    await sleep(2000);

    logger.info({ udid, bundleId }, 'App launched successfully');
  }

  /**
   * Terminate app on Simulator
   */
  async terminateApp(udid: string, bundleId: string): Promise<void> {
    logger.debug({ udid, bundleId }, 'Terminating app');

    const result = await simctl(['terminate', udid, bundleId]);

    if (result.exitCode !== 0 && !result.stderr.includes('No such process')) {
      logger.warn({ udid, bundleId, stderr: result.stderr }, 'Failed to terminate app');
    }
  }

  /**
   * Reset app state (uninstall + reinstall + launch)
   */
  async resetApp(udid: string, bundleId: string, appPath: string): Promise<void> {
    logger.info({ udid, bundleId }, 'Resetting app state');

    await this.terminateApp(udid, bundleId);
    await this.uninstallApp(udid, bundleId);
    await this.installApp(udid, appPath);
    await this.launchApp(udid, bundleId);

    logger.info({ udid, bundleId }, 'App reset successfully');
  }

  /**
   * Extract .app bundle from .ipa file
   */
  private async extractIpaBundle(ipaPath: string): Promise<string> {
    logger.debug({ ipaPath }, 'Extracting .app from .ipa');

    const tmpDir = `/tmp/aperture-ipa-${Date.now()}`;
    await fs.mkdir(tmpDir, { recursive: true });

    // Unzip IPA
    const result = await xcrun(['unzip', '-q', ipaPath, '-d', tmpDir]);

    if (result.exitCode !== 0) {
      throw new DeviceError('Failed to extract IPA', 'APP_INSTALL_FAILED', {
        ipaPath,
        stderr: result.stderr,
      });
    }

    // Find .app bundle in Payload directory
    const payloadDir = path.join(tmpDir, 'Payload');
    const entries = await fs.readdir(payloadDir);
    const appBundle = entries.find((e) => e.endsWith('.app'));

    if (!appBundle) {
      throw new DeviceError('No .app bundle found in IPA', 'APP_INSTALL_FAILED', {
        ipaPath,
      });
    }

    return path.join(payloadDir, appBundle);
  }

  /**
   * Get bundle ID from .app bundle
   */
  private async getBundleId(appPath: string): Promise<string> {
    const infoPlistPath = path.join(appPath, 'Info.plist');

    const result = await xcrun([
      'plutil',
      '-extract',
      'CFBundleIdentifier',
      'raw',
      infoPlistPath,
    ]);

    if (result.exitCode !== 0) {
      throw new DeviceError('Failed to read bundle ID', 'APP_INSTALL_FAILED', {
        appPath,
        stderr: result.stderr,
      });
    }

    return result.stdout.trim();
  }

  /**
   * Detect device type from name
   */
  private detectDeviceType(name: string): DeviceType {
    if (name.includes('iPad')) return 'iPad';
    if (name.includes('iPhone')) return 'iPhone';
    return 'Unknown';
  }

  /**
   * Get boot status with details
   */
  async getBootStatus(udid: string): Promise<BootStatus> {
    const device = await this.getDevice(udid);

    return {
      state: device.state,
      isReady: device.state === 'Booted',
      message: this.getStatusMessage(device.state),
    };
  }

  /**
   * Get human-readable status message
   */
  private getStatusMessage(state: DeviceState): string {
    switch (state) {
      case 'Booted':
        return 'Device is ready';
      case 'Booting':
        return 'Device is starting up...';
      case 'Shutdown':
        return 'Device is off';
      case 'Shutting Down':
        return 'Device is shutting down...';
      case 'Creating':
        return 'Device is being created...';
      default:
        return 'Unknown state';
    }
  }
}

/**
 * Default singleton instance
 */
export const deviceManager = new DeviceManager();
