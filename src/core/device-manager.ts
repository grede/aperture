import { exec } from 'child_process';
import { promisify } from 'util';
import type { SimulatorDevice } from '../types/index.js';

const execAsync = promisify(exec);

// ── DeviceManager Class ────────────────────────────────────────

export class DeviceManager {
  /**
   * List all available iOS Simulators
   */
  async listDevices(bootedOnly = false): Promise<SimulatorDevice[]> {
    const { stdout } = await execAsync('xcrun simctl list devices available -j');
    const data = JSON.parse(stdout);

    const devices: SimulatorDevice[] = [];

    for (const [runtime, deviceList] of Object.entries(data.devices)) {
      if (!runtime.includes('iOS')) continue;

      for (const device of deviceList as any[]) {
        if (bootedOnly && device.state !== 'Booted') continue;

        const deviceType = this.determineDeviceType(device.name);

        devices.push({
          udid: device.udid,
          name: device.name,
          runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', ''),
          state: device.state,
          deviceType,
        });
      }
    }

    return devices;
  }

  /**
   * Boot a Simulator if not already booted
   */
  async boot(udid: string): Promise<void> {
    const devices = await this.listDevices();
    const device = devices.find((d) => d.udid === udid);

    if (!device) {
      throw new Error(`Device with UDID ${udid} not found`);
    }

    if (device.state === 'Booted') {
      return; // Already booted
    }

    await execAsync(`xcrun simctl boot ${udid}`);

    // Wait for boot to complete
    await this.waitForBoot(udid);
  }

  /**
   * Shutdown a Simulator
   */
  async shutdown(udid: string): Promise<void> {
    await execAsync(`xcrun simctl shutdown ${udid}`);
  }

  /**
   * Install an app bundle on a Simulator
   */
  async install(udid: string, appPath: string): Promise<void> {
    await execAsync(`xcrun simctl install ${udid} "${appPath}"`);
  }

  /**
   * Launch an app by bundle ID
   */
  async launch(udid: string, bundleId: string): Promise<void> {
    await execAsync(`xcrun simctl launch ${udid} ${bundleId}`);
  }

  /**
   * Terminate an app by bundle ID
   */
  async terminate(udid: string, bundleId: string): Promise<void> {
    try {
      await execAsync(`xcrun simctl terminate ${udid} ${bundleId}`);
    } catch (error) {
      // App might not be running, ignore error
    }
  }

  /**
   * Uninstall an app by bundle ID
   */
  async uninstall(udid: string, bundleId: string): Promise<void> {
    try {
      await execAsync(`xcrun simctl uninstall ${udid} ${bundleId}`);
    } catch (error) {
      // App might not be installed, ignore error
    }
  }

  /**
   * Erase all content and settings (reset Simulator)
   */
  async reset(udid: string): Promise<void> {
    // Must shutdown first
    await this.shutdown(udid);
    await execAsync(`xcrun simctl erase ${udid}`);
  }

  /**
   * Set status bar to 9:41 with full battery/signal/wifi
   */
  async setStatusBar(udid: string): Promise<void> {
    await execAsync(
      `xcrun simctl status_bar ${udid} override --time "9:41" --batteryLevel 100 --batteryState charged --cellularMode active --cellularBars 4 --wifiBars 3`
    );
  }

  /**
   * Clear status bar overrides
   */
  async clearStatusBar(udid: string): Promise<void> {
    await execAsync(`xcrun simctl status_bar ${udid} clear`);
  }

  /**
   * Wait for Simulator to finish booting
   */
  private async waitForBoot(udid: string, maxWaitMs = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const { stdout } = await execAsync(`xcrun simctl bootstatus ${udid} -b`);

      if (stdout.includes('Boot status: Booted')) {
        // Give it a few more seconds to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Simulator ${udid} failed to boot within ${maxWaitMs}ms`);
  }

  /**
   * Determine if a device is iPhone or iPad based on name
   */
  private determineDeviceType(name: string): 'iPhone' | 'iPad' {
    return name.toLowerCase().includes('ipad') ? 'iPad' : 'iPhone';
  }

  /**
   * Get the bundle ID from an .app bundle
   */
  async getBundleId(appPath: string): Promise<string> {
    const { stdout } = await execAsync(
      `/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${appPath}/Info.plist"`
    );
    return stdout.trim();
  }
}
