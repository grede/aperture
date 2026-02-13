import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import findFreePort from 'find-free-port';
import kill from 'tree-kill';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

export interface AppiumProcess {
  pid: number;
  port: number;
  startTime: Date;
  logFile: string;
}

export interface AppiumStatus {
  running: boolean;
  port?: number;
  pid?: number;
  uptime?: number;
  version?: string;
}

interface AppiumState {
  pid: number;
  port: number;
  startTime: string;
  logFile: string;
}

export class AppiumManager {
  private stateDir = '.aperture';
  private stateFile = path.join(this.stateDir, 'appium.state');
  private logsDir = 'logs';
  private process: ChildProcess | null = null;

  async isInstalled(): Promise<boolean> {
    try {
      await exec('npx', ['appium', '--version'], { logCommand: false, timeout: 5000 });
      return true;
    } catch {
      try {
        await exec('appium', ['--version'], { logCommand: false, timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  async install(onProgress?: (message: string) => void): Promise<void> {
    onProgress?.('Installing Appium...');
    const appiumResult = await exec('npm', ['install', '--save-dev', 'appium'], { timeout: 120000 });
    if (appiumResult.exitCode !== 0) throw new Error('Failed to install Appium');

    onProgress?.('Installing XCUITest driver...');
    const driverResult = await exec('npx', ['appium', 'driver', 'install', 'xcuitest'], { timeout: 90000 });
    if (driverResult.exitCode !== 0) throw new Error('Failed to install driver');
  }

  async start(port?: number, maxRetries = 3): Promise<AppiumProcess> {
    // Check if server is already running and healthy
    if (await this.isRunning()) {
      const state = await this.loadState();
      if (state) return { pid: state.pid, port: state.port, startTime: new Date(state.startTime), logFile: state.logFile };
    }

    // Clear stale state if server is not running
    await this.clearState();

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const selectedPort = port || (await findFreePort(8100).then(([p]: [number]) => p));
        if (!selectedPort) {
          throw new Error('Failed to find free port');
        }

        await fs.mkdir(this.logsDir, { recursive: true });
        const timestamp = Date.now();
        const logFile = path.join(this.logsDir, `appium-${timestamp}.log`);
        const logStream = await fs.open(logFile, 'w');

        this.process = spawn('npx', ['appium', '--port', String(selectedPort)], {
          detached: true,
          stdio: ['ignore', logStream.fd, logStream.fd],
        });

        const pid = this.process.pid as number;
        this.process.unref();

        const processInfo: AppiumProcess = { pid, port: selectedPort, startTime: new Date(), logFile };
        await this.saveState(processInfo);
        await this.waitForHealthy(selectedPort, 30000);

        logger.info({ port: selectedPort, pid, attempt }, 'Appium server started successfully');
        return processInfo;
      } catch (error) {
        lastError = error as Error;
        logger.warn({ attempt, maxRetries, error }, 'Failed to start Appium server');

        // Clear state and wait before retry
        await this.clearState();
        if (attempt < maxRetries) {
          logger.info({ attempt, waitTime: 2000 }, 'Retrying Appium server start');
          await sleep(2000);
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to start Appium server after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async stop(): Promise<void> {
    const state = await this.loadState();
    if (!state) return;
    await new Promise<void>(r => kill(state.pid, 'SIGTERM', () => r()));
    await sleep(1000);
    await this.clearState();
  }

  async isRunning(): Promise<boolean> {
    const state = await this.loadState();
    if (!state) return false;
    try {
      process.kill(state.pid, 0);
      return await this.healthCheck(state.port);
    } catch {
      await this.clearState();
      return false;
    }
  }

  async getStatus(): Promise<AppiumStatus> {
    const state = await this.loadState();
    if (!state) return { running: false };
    try {
      process.kill(state.pid, 0);
      if (!(await this.healthCheck(state.port))) return { running: false };
      return { running: true, port: state.port, pid: state.pid, uptime: Date.now() - new Date(state.startTime).getTime() };
    } catch {
      return { running: false };
    }
  }

  async healthCheck(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/status`, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ensure Appium server is running and healthy.
   * Attempts to restart if server is unresponsive.
   */
  async ensureHealthy(port?: number): Promise<AppiumProcess> {
    const state = await this.loadState();

    // If we have state, check if process is healthy
    if (state) {
      try {
        process.kill(state.pid, 0); // Check if process exists
        if (await this.healthCheck(state.port)) {
          // Server is healthy
          return { pid: state.pid, port: state.port, startTime: new Date(state.startTime), logFile: state.logFile };
        }
      } catch {
        // Process doesn't exist
      }

      // Server is not healthy, try to stop it
      logger.warn({ pid: state.pid, port: state.port }, 'Appium server is unresponsive, attempting restart');
      try {
        await this.stop();
      } catch {
        // Ignore stop errors
      }
    }

    // Start fresh server
    return await this.start(port);
  }

  private async waitForHealthy(port: number, timeout: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await this.healthCheck(port)) return;
      await sleep(1000);
    }
    throw new Error('Appium server failed to start');
  }

  async getLogs(lines = 50): Promise<string> {
    const state = await this.loadState();
    if (!state?.logFile) return 'No logs available';
    try {
      const content = await fs.readFile(state.logFile, 'utf-8');
      return content.split('\n').slice(-lines).join('\n');
    } catch {
      return 'Failed to read logs';
    }
  }

  private async saveState(info: AppiumProcess): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify({
      pid: info.pid,
      port: info.port,
      startTime: info.startTime.toISOString(),
      logFile: info.logFile,
    }, null, 2));
  }

  private async loadState(): Promise<AppiumState | null> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async clearState(): Promise<void> {
    try { await fs.unlink(this.stateFile); } catch {}
  }
}

export const appiumManager = new AppiumManager();
