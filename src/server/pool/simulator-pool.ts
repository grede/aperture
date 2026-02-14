import { DeviceManager } from '../../core/device-manager.js';
import type { SimulatorPoolEntry } from '../types.js';

// ── SimulatorPool Class ────────────────────────────────────────

export class SimulatorPool {
  private pool: Map<string, SimulatorPoolEntry> = new Map();
  private deviceManager: DeviceManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(deviceManager: DeviceManager) {
    this.deviceManager = deviceManager;
  }

  /**
   * Initialize the pool with pre-booted simulators
   */
  async initialize(iPhoneCount: number, iPadCount: number): Promise<void> {
    const devices = await this.deviceManager.listDevices();

    const iPhones = devices.filter((d) => d.deviceType === 'iPhone').slice(0, iPhoneCount);
    const iPads = devices.filter((d) => d.deviceType === 'iPad').slice(0, iPadCount);

    // Boot all simulators
    for (const device of [...iPhones, ...iPads]) {
      console.log(`[Pool] Booting ${device.name} (${device.udid})...`);
      await this.deviceManager.boot(device.udid);

      this.pool.set(device.udid, {
        udid: device.udid,
        name: device.name,
        deviceType: device.deviceType,
        state: 'available',
        lastHealthCheck: new Date(),
      });
    }

    // Start health checks
    this.startHealthChecks();

    console.log(`[Pool] Initialized with ${this.pool.size} simulator(s)`);
  }

  /**
   * Acquire a simulator pair (iPhone + iPad) for a job
   */
  async acquire(jobId: string): Promise<{ iphone: string; ipad: string }> {
    const availableIPhone = Array.from(this.pool.values()).find(
      (sim) => sim.deviceType === 'iPhone' && sim.state === 'available'
    );

    const availableIPad = Array.from(this.pool.values()).find(
      (sim) => sim.deviceType === 'iPad' && sim.state === 'available'
    );

    if (!availableIPhone || !availableIPad) {
      throw new Error('No available simulators in pool');
    }

    // Mark as in-use
    availableIPhone.state = 'in-use';
    availableIPhone.currentJobId = jobId;
    availableIPad.state = 'in-use';
    availableIPad.currentJobId = jobId;

    return {
      iphone: availableIPhone.udid,
      ipad: availableIPad.udid,
    };
  }

  /**
   * Release simulators back to the pool
   */
  async release(udids: string[]): Promise<void> {
    for (const udid of udids) {
      const sim = this.pool.get(udid);
      if (!sim) continue;

      // Reset the simulator
      try {
        await this.deviceManager.reset(udid);
        await this.deviceManager.boot(udid);

        sim.state = 'available';
        sim.currentJobId = undefined;
      } catch (error) {
        console.error(`[Pool] Failed to reset simulator ${udid}:`, error);
        sim.state = 'unhealthy';
      }
    }
  }

  /**
   * Get pool status
   */
  getStatus(): {
    total: number;
    available: number;
    inUse: number;
    unhealthy: number;
    simulators: SimulatorPoolEntry[];
  } {
    const simulators = Array.from(this.pool.values());

    return {
      total: simulators.length,
      available: simulators.filter((s) => s.state === 'available').length,
      inUse: simulators.filter((s) => s.state === 'in-use').length,
      unhealthy: simulators.filter((s) => s.state === 'unhealthy').length,
      simulators,
    };
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [udid, sim] of this.pool.entries()) {
        if (sim.state === 'available') {
          try {
            // Simple health check: list devices
            const devices = await this.deviceManager.listDevices();
            const device = devices.find((d) => d.udid === udid);

            if (!device || device.state !== 'Booted') {
              sim.state = 'unhealthy';
              console.warn(`[Pool] Simulator ${udid} is unhealthy`);
            }

            sim.lastHealthCheck = new Date();
          } catch (error) {
            sim.state = 'unhealthy';
            console.error(`[Pool] Health check failed for ${udid}:`, error);
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop health checks and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown all simulators
    for (const udid of this.pool.keys()) {
      try {
        await this.deviceManager.shutdown(udid);
      } catch (error) {
        console.error(`[Pool] Failed to shutdown simulator ${udid}:`, error);
      }
    }

    this.pool.clear();
  }
}
