import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';
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

  /**
   * Check if WebDriverAgent is running and responding on port 8100
   */
  async isWebDriverAgentRunning(): Promise<boolean> {
    try {
      // Try to fetch the status endpoint
      const response = await fetch('http://localhost:8100/status');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Start WebDriverAgent for a specific device UDID
   * Returns the child process (caller should keep it alive)
   */
  async startWebDriverAgent(udid: string): Promise<ChildProcess> {
    const wdaPath = join(homedir(), 'WebDriverAgent');

    // Start WDA in test mode using UDID (keeps running and serves HTTP API)
    const proc = spawn(
      'xcodebuild',
      [
        '-project',
        join(wdaPath, 'WebDriverAgent.xcodeproj'),
        '-scheme',
        'WebDriverAgentRunner',
        '-destination',
        `id=${udid}`,
        'test',
      ],
      {
        cwd: wdaPath,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr for debugging
      }
    );

    // Don't unref - we want to keep reference to monitor it
    // But use detached so it can continue running

    return proc;
  }

  /**
   * Wait for WebDriverAgent to be ready
   * Polls the HTTP endpoint until it responds
   */
  async waitForWebDriverAgent(maxWaitMs = 90000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (await this.isWebDriverAgentRunning()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`WebDriverAgent failed to start within ${maxWaitMs / 1000}s`);
  }

  /**
   * Ensure WebDriverAgent is running for the specified device UDID
   * Starts it if not already running
   */
  async ensureWebDriverAgentRunning(udid: string): Promise<ChildProcess | null> {
    const isRunning = await this.isWebDriverAgentRunning();

    if (!isRunning) {
      const proc = await this.startWebDriverAgent(udid);
      await this.waitForWebDriverAgent();
      return proc;
    }

    return null;
  }
}
