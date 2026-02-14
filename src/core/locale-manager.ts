import { readFile, writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import plist from 'plist';
import type { DeviceManager } from './device-manager.js';

const execAsync = promisify(exec);

// ── Supported App Store Connect Locales ────────────────────────

const SUPPORTED_LOCALES = [
  'ar',      // Arabic
  'ca',      // Catalan
  'cs',      // Czech
  'da',      // Danish
  'de',      // German
  'el',      // Greek
  'en-AU',   // English (Australia)
  'en-CA',   // English (Canada)
  'en-GB',   // English (UK)
  'en-US',   // English (US)
  'es',      // Spanish (Spain)
  'es-MX',   // Spanish (Mexico)
  'fi',      // Finnish
  'fr',      // French (France)
  'fr-CA',   // French (Canada)
  'he',      // Hebrew
  'hi',      // Hindi
  'hr',      // Croatian
  'hu',      // Hungarian
  'id',      // Indonesian
  'it',      // Italian
  'ja',      // Japanese
  'ko',      // Korean
  'ms',      // Malay
  'nl',      // Dutch
  'no',      // Norwegian
  'pl',      // Polish
  'pt-BR',   // Portuguese (Brazil)
  'pt-PT',   // Portuguese (Portugal)
  'ro',      // Romanian
  'ru',      // Russian
  'sk',      // Slovak
  'sv',      // Swedish
  'th',      // Thai
  'tr',      // Turkish
  'uk',      // Ukrainian
  'vi',      // Vietnamese
  'zh-Hans', // Chinese (Simplified)
  'zh-Hant', // Chinese (Traditional)
];

// ── LocaleManager Class ────────────────────────────────────────

export class LocaleManager {
  private deviceManager: DeviceManager;

  constructor(deviceManager: DeviceManager) {
    this.deviceManager = deviceManager;
  }

  /**
   * Set the Simulator's locale and reboot
   */
  async setLocale(udid: string, locale: string): Promise<void> {
    // Validate locale
    if (!SUPPORTED_LOCALES.includes(locale)) {
      throw new Error(
        `Unsupported locale: ${locale}. Must be one of: ${SUPPORTED_LOCALES.join(', ')}`
      );
    }

    // Get the Simulator's data directory
    const { stdout: deviceInfo } = await execAsync(`xcrun simctl getenv ${udid} HOME`);
    const homeDir = deviceInfo.trim();

    if (!homeDir) {
      throw new Error(`Could not determine home directory for Simulator ${udid}`);
    }

    // Path to GlobalPreferences.plist
    const plistPath = `${homeDir}/Library/Preferences/.GlobalPreferences.plist`;

    try {
      // Read existing plist (or create new one)
      let preferences: Record<string, unknown> = {};

      try {
        const plistContent = await readFile(plistPath, 'utf-8');
        preferences = plist.parse(plistContent) as Record<string, unknown>;
      } catch (error) {
        // Plist doesn't exist yet, start with empty preferences
      }

      // Set AppleLanguages and AppleLocale
      preferences.AppleLanguages = [locale];
      preferences.AppleLocale = locale;

      // Write back to plist
      const updatedPlist = plist.build(preferences as any);
      await writeFile(plistPath, updatedPlist);

      // Reboot the Simulator for changes to take effect
      await this.deviceManager.shutdown(udid);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for shutdown
      await this.deviceManager.boot(udid);

    } catch (error) {
      throw new Error(
        `Failed to set locale for Simulator ${udid}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Get the current locale of the Simulator
   */
  async getCurrentLocale(udid: string): Promise<string> {
    const { stdout: deviceInfo } = await execAsync(`xcrun simctl getenv ${udid} HOME`);
    const homeDir = deviceInfo.trim();

    if (!homeDir) {
      throw new Error(`Could not determine home directory for Simulator ${udid}`);
    }

    const plistPath = `${homeDir}/Library/Preferences/.GlobalPreferences.plist`;

    try {
      const plistContent = await readFile(plistPath, 'utf-8');
      const preferences = plist.parse(plistContent) as Record<string, unknown>;

      if (Array.isArray(preferences.AppleLanguages) && preferences.AppleLanguages.length > 0) {
        return preferences.AppleLanguages[0] as string;
      }

      // Default to en-US if not set
      return 'en-US';
    } catch (error) {
      // Plist doesn't exist or can't be read, assume en-US
      return 'en-US';
    }
  }

  /**
   * Get list of all supported App Store Connect locales
   */
  getSupportedLocales(): string[] {
    return [...SUPPORTED_LOCALES];
  }

  /**
   * Validate if a locale is supported
   */
  isSupported(locale: string): boolean {
    return SUPPORTED_LOCALES.includes(locale);
  }
}
