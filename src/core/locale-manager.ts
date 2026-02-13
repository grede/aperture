import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';
import { LocaleError } from '../types/errors.js';

export class LocaleManager {
  async setLocale(udid: string, localeCode: string): Promise<void> {
    logger.info({ udid, locale: localeCode }, 'Changing Simulator locale');
    try {
      const dataDir = await this.getSimulatorDataDir(udid);
      const plistPath = dataDir + '/data/Library/Preferences/.GlobalPreferences.plist';
      const appleLocale = this.toAppleLocaleIdentifier(localeCode);
      await this.setPlistArrayValue(plistPath, 'AppleLanguages', [localeCode]);
      await this.setPlistValue(plistPath, 'AppleLocale', appleLocale);
      logger.info({ locale: localeCode, appleLocale }, 'Locale preferences updated');
    } catch (error) {
      throw new LocaleError('Failed to set Simulator locale: ' + (error as Error).message, 'LOCALE_SWITCH_FAILED', { udid, localeCode, error });
    }
  }

  async rebootSimulator(udid: string, timeout = 60000): Promise<void> {
    logger.info({ udid }, 'Rebooting Simulator');
    try {
      const shutdownResult = await exec('xcrun', ['simctl', 'shutdown', udid], { timeout: 10000 });
      if (shutdownResult.exitCode !== 0 && !shutdownResult.stderr.includes('Unable to shutdown device in current state: Shutdown')) {
        throw new Error('Shutdown failed: ' + shutdownResult.stderr);
      }
      await sleep(2000);
      const bootResult = await exec('xcrun', ['simctl', 'boot', udid], { timeout: 30000 });
      if (bootResult.exitCode !== 0) {
        throw new Error('Boot failed: ' + bootResult.stderr);
      }
      await this.waitForBoot(udid, timeout);
      logger.info({ udid }, 'Simulator rebooted successfully');
    } catch (error) {
      throw new LocaleError('Failed to reboot Simulator: ' + (error as Error).message, 'LOCALE_SWITCH_FAILED', { udid, error });
    }
  }

  private async waitForBoot(udid: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const result = await exec('xcrun', ['simctl', 'list', 'devices'], { logCommand: false });
      if (result.stdout.includes(udid) && result.stdout.includes('(Booted)')) {
        await sleep(5000);
        return;
      }
      await sleep(1000);
    }
    throw new Error('Simulator boot timeout after ' + timeout + 'ms');
  }

  private async getSimulatorDataDir(udid: string): Promise<string> {
    const result = await exec('xcrun', ['simctl', 'getenv', udid, 'HOME']);
    if (result.exitCode !== 0) {
      throw new Error('Failed to get Simulator data dir: ' + result.stderr);
    }
    return result.stdout.trim();
  }

  private async setPlistValue(plistPath: string, key: string, value: string): Promise<void> {
    const result = await exec('plutil', ['-replace', key, '-string', value, plistPath]);
    if (result.exitCode !== 0) {
      throw new Error('Failed to set plist value ' + key + ': ' + result.stderr);
    }
  }

  private async setPlistArrayValue(plistPath: string, key: string, values: string[]): Promise<void> {
    await exec('plutil', ['-remove', key, plistPath]);
    await exec('plutil', ['-insert', key, '-array', plistPath]);
    for (let i = 0; i < values.length; i++) {
      const result = await exec('plutil', ['-insert', key, '-string', values[i], '-append', plistPath]);
      if (result.exitCode !== 0) {
        throw new Error('Failed to add array value to ' + key + ': ' + result.stderr);
      }
    }
  }

  private toAppleLocaleIdentifier(localeCode: string): string {
    if (localeCode.includes('-') || localeCode.includes('_')) {
      return localeCode.replace('-', '_');
    }
    const localeMap: Record<string, string> = {
      en: 'en_US', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', it: 'it_IT', pt: 'pt_BR',
      ja: 'ja_JP', ko: 'ko_KR', zh: 'zh_CN', ru: 'ru_RU', ar: 'ar_SA', hi: 'hi_IN',
      nl: 'nl_NL', sv: 'sv_SE', pl: 'pl_PL',
    };
    return localeMap[localeCode] || localeCode + '_' + localeCode.toUpperCase();
  }
}

export const localeManager = new LocaleManager();
