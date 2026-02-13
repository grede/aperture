import { remote, type RemoteOptions, type Browser } from 'webdriverio';
import { DeviceError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import type { SimulatorDevice } from '../types/device.js';

/**
 * WebDriverAgent connection configuration
 */
export interface WDAConnectionOptions {
  /** Simulator UDID */
  udid: string;
  /** Bundle identifier of the app */
  bundleId: string;
  /** WDA port (default: 8100) */
  port?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * WebDriverAgent connection manager
 * Handles connection to Appium XCUITest driver for iOS automation
 */
export class WDAConnection {
  private browser: Browser | null = null;
  private options: WDAConnectionOptions;

  constructor(options: WDAConnectionOptions) {
    this.options = {
      port: 8100,
      timeout: 30000,
      ...options,
    };
  }

  /**
   * Connect to WebDriverAgent on Simulator
   */
  async connect(): Promise<Browser> {
    logger.info({ udid: this.options.udid }, 'Connecting to WebDriverAgent');

    const wdioOptions: RemoteOptions = {
      hostname: 'localhost',
      port: this.options.port,
      path: '/',
      capabilities: {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:udid': this.options.udid,
        'appium:bundleId': this.options.bundleId,
        'appium:noReset': true,
        'appium:fullReset': false,
        'appium:wdaLocalPort': 8101,
      },
      logLevel: 'error',
      waitforTimeout: 10000,
      connectionRetryTimeout: this.options.timeout,
      connectionRetryCount: 3,
    };

    try {
      this.browser = await retry(
        async () => {
          logger.debug('Attempting WebDriverAgent connection...');
          return await remote(wdioOptions);
        },
        {
          maxAttempts: 3,
          initialDelay: 2000,
          backoffMultiplier: 2,
        }
      );

      logger.info('WebDriverAgent connected successfully');
      return this.browser;
    } catch (error) {
      const errorMessage = [
        'Failed to connect to WebDriverAgent.',
        '\nPossible solutions:',
        '  1. Build WebDriverAgent: npx appium driver run xcuitest build-wda',
        '  2. Check Appium server status: aperture server status',
        '  3. View logs for details: aperture server logs',
      ].join('\n');

      throw new DeviceError(
        errorMessage,
        'WDA_CONNECTION_FAILED',
        {
          udid: this.options.udid,
          port: this.options.port,
          error,
        }
      );
    }
  }

  /**
   * Get the active browser session
   */
  getBrowser(): Browser {
    if (!this.browser) {
      throw new DeviceError(
        'WebDriverAgent not connected. Call connect() first.',
        'WDA_CONNECTION_FAILED',
        {}
      );
    }
    return this.browser;
  }

  /**
   * Get current accessibility tree (page source)
   */
  async getAccessibilityTree(): Promise<string> {
    const browser = this.getBrowser();
    const source = await browser.getPageSource();
    return source;
  }

  /**
   * Find element by accessibility ID
   */
  async findByAccessibilityId(id: string) {
    const browser = this.getBrowser();
    return await browser.$(`~${id}`);
  }

  /**
   * Find element by XPath
   */
  async findByXPath(xpath: string) {
    const browser = this.getBrowser();
    return await browser.$(xpath);
  }

  /**
   * Tap element at coordinates
   */
  async tap(x: number, y: number): Promise<void> {
    const browser = this.getBrowser();
    await browser.touchAction({
      action: 'tap',
      x,
      y,
    });
  }

  /**
   * Type text into currently focused element
   */
  async type(text: string): Promise<void> {
    const browser = this.getBrowser();
    const activeElement = await browser.$('//*[@focused="true"]');

    if (await activeElement.isExisting()) {
      await activeElement.setValue(text);
    } else {
      logger.warn('No focused element found for typing');
      throw new Error('No focused element for text input');
    }
  }

  /**
   * Swipe gesture
   */
  async swipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration = 300
  ): Promise<void> {
    const browser = this.getBrowser();
    await browser.touchAction([
      { action: 'press', x: startX, y: startY },
      { action: 'wait', ms: duration },
      { action: 'moveTo', x: endX, y: endY },
      'release',
    ]);
  }

  /**
   * Press home button
   */
  async pressHome(): Promise<void> {
    const browser = this.getBrowser();
    // XCUITest uses app.terminate() then background to go home
    await browser.execute('mobile: pressButton', { name: 'home' });
  }

  /**
   * Go back (swipe from left edge)
   */
  async goBack(): Promise<void> {
    // iOS back gesture: swipe from left edge
    const screenSize = await this.getScreenSize();
    await this.swipe(10, screenSize.height / 2, screenSize.width / 2, screenSize.height / 2, 300);
  }

  /**
   * Get screen size
   */
  async getScreenSize(): Promise<{ width: number; height: number }> {
    const browser = this.getBrowser();
    const size = await browser.getWindowRect();
    return { width: size.width, height: size.height };
  }

  /**
   * Wait for element to exist
   */
  async waitForElement(selector: string, timeout = 10000): Promise<boolean> {
    try {
      const browser = this.getBrowser();
      const element = await browser.$(selector);
      await element.waitForExist({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnect from WebDriverAgent
   */
  async disconnect(): Promise<void> {
    if (this.browser) {
      logger.info('Disconnecting from WebDriverAgent');
      await this.browser.deleteSession();
      this.browser = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.browser !== null;
  }
}

/**
 * Create and connect to WebDriverAgent
 */
export async function connectToWDA(
  device: SimulatorDevice,
  bundleId: string,
  port = 8100
): Promise<WDAConnection> {
  const connection = new WDAConnection({
    udid: device.udid,
    bundleId,
    port,
  });

  await connection.connect();
  return connection;
}
