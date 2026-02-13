import fs from 'fs/promises';
import path from 'path';
import type { SelectorCache, SelectorCacheEntry } from '../types/player.js';
import { logger } from '../utils/logger.js';

/**
 * Selector cache manager (US-016)
 */
export class SelectorCacheManager {
  private cacheDir = 'cache';

  /**
   * Load selector cache for a template and locale
   */
  async load(templateId: string, locale: string, templateHash: string): Promise<SelectorCache | null> {
    try {
      const filepath = this.getCachePath(templateId, locale);
      const content = await fs.readFile(filepath, 'utf-8');
      const cache: SelectorCache = JSON.parse(content);

      // Validate cache against template hash
      if (cache.templateHash !== templateHash) {
        logger.warn(
          { templateId, locale, cacheHash: cache.templateHash, templateHash },
          'Cache invalidated: template hash mismatch'
        );
        return null;
      }

      logger.debug({ templateId, locale, entryCount: cache.entries.length }, 'Selector cache loaded');
      return cache;
    } catch (error) {
      // Cache file doesn't exist or is corrupted
      logger.debug({ templateId, locale }, 'No selector cache found');
      return null;
    }
  }

  /**
   * Save selector cache for a template and locale
   */
  async save(cache: SelectorCache): Promise<void> {
    try {
      const filepath = this.getCachePath(cache.recordingId, cache.locale || 'default');
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, JSON.stringify(cache, null, 2));
      logger.info({ recordingId: cache.recordingId, locale: cache.locale, entryCount: cache.entries.length }, 'Selector cache saved');
    } catch (error) {
      logger.error({ error }, 'Failed to save selector cache');
    }
  }

  /**
   * Add entry to cache
   */
  addEntry(cache: SelectorCache, entry: SelectorCacheEntry): void {
    // Remove existing entry for same step if present
    cache.entries = cache.entries.filter((e) => e.stepIndex !== entry.stepIndex);
    cache.entries.push(entry);
    cache.updatedAt = new Date().toISOString();
  }

  /**
   * Get cached selector for a step
   */
  getCachedSelector(cache: SelectorCache, stepIndex: number): SelectorCacheEntry | null {
    return cache.entries.find((e) => e.stepIndex === stepIndex) || null;
  }

  /**
   * Clear cache for a template
   */
  async clear(templateId: string, locale?: string): Promise<void> {
    try {
      if (locale) {
        const filepath = this.getCachePath(templateId, locale);
        await fs.unlink(filepath);
        logger.info({ templateId, locale }, 'Selector cache cleared');
      } else {
        const templateDir = path.join(this.cacheDir, templateId);
        await fs.rm(templateDir, { recursive: true, force: true });
        logger.info({ templateId }, 'All selector caches cleared for template');
      }
    } catch (error) {
      logger.warn({ templateId, locale, error }, 'Failed to clear cache');
    }
  }

  /**
   * Initialize empty cache
   */
  initCache(recordingId: string, locale: string | undefined, templateHash: string): SelectorCache {
    return {
      recordingId,
      locale,
      templateHash,
      entries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get cache file path
   */
  private getCachePath(templateId: string, locale: string): string {
    return path.join(this.cacheDir, templateId, `${locale}.json`);
  }
}

export const selectorCacheManager = new SelectorCacheManager();
