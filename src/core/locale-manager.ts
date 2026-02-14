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
      // Check if plist exists, create if needed
      try {
        await readFile(plistPath);
      } catch {
        // Plist doesn't exist, create a minimal one
        const minimal = plist.build({
          AppleLanguages: [locale],
          AppleLocale: locale,
        } as any);
        await writeFile(plistPath, minimal);

        // Convert to binary format for consistency with iOS
        await execAsync(`plutil -convert binary1 "${plistPath}"`);
      }

      // Use plutil to update locale values (handles both binary and XML)
      // First, ensure the plist has an AppleLanguages array
      try {
        await execAsync(`plutil -replace AppleLanguages -json '["${locale}"]' "${plistPath}"`);
      } catch {
        // Array might not exist, create it
        await execAsync(`plutil -insert AppleLanguages -json '["${locale}"]' "${plistPath}"`);
      }

      // Set AppleLocale
      try {
        await execAsync(`plutil -replace AppleLocale -string "${locale}" "${plistPath}"`);
      } catch {
        // Key might not exist, create it
        await execAsync(`plutil -insert AppleLocale -string "${locale}" "${plistPath}"`);
      }

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
      // Use plutil to extract the first AppleLanguage value (handles binary plists)
      const { stdout } = await execAsync(
        `plutil -extract AppleLanguages.0 raw -o - "${plistPath}"`
      );

      const locale = stdout.trim();
      return locale || 'en-US';
    } catch (error) {
      // Plist doesn't exist or AppleLanguages not set, assume en-US
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
