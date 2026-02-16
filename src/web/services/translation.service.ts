/**
 * Translation service - wraps TranslationService for web backend use
 */

import { TranslationService as CoreTranslationService } from '../../localization/translation-service';
import { ensureWebEnvLoaded } from '../lib/env';

ensureWebEnvLoaded();

/**
 * Web translation service for AI-powered copy generation
 */
export class WebTranslationService {
  private service: CoreTranslationService;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    this.service = new CoreTranslationService(this.apiKey, model);
  }

  /**
   * Generate marketing copy for a single screen
   * @param screenshotLabel - Screenshot identifier
   * @param locale - Target locale
   * @param appDescription - Brief app description for context
   * @param screenshotContext - Description of what the screenshot shows
   * @returns Generated title and subtitle
   */
  async generateCopy(
    screenshotLabel: string,
    locale: string,
    appDescription: string,
    screenshotContext: string
  ): Promise<{ title: string; subtitle: string }> {
    return this.service.generateCopy(
      screenshotLabel,
      locale,
      appDescription,
      screenshotContext
    );
  }

  /**
   * Translate multiple copies to a target locale
   * @param copies - Array of source copies (title + subtitle)
   * @param targetLocale - Target locale code
   * @param appDescription - App description for context
   * @returns Array of translated copies
   */
  async translateCopies(
    copies: Array<{ label: string; title: string; subtitle?: string }>,
    targetLocale: string,
    appDescription: string
  ): Promise<Array<{ title: string; subtitle: string }>> {
    const results = [];

    for (const copy of copies) {
      const context = copy.subtitle
        ? `Title: ${copy.title}, Subtitle: ${copy.subtitle}`
        : `Title: ${copy.title}`;

      const generated = await this.service.generateCopy(
        copy.label,
        targetLocale,
        appDescription,
        context
      );

      results.push(generated);
    }

    return results;
  }

  /**
   * Batch translate copies for multiple locales
   * @param copies - Source copies
   * @param sourceLocale - Source locale
   * @param targetLocales - Target locale codes
   * @param appDescription - App description
   * @returns Map of locale -> translated copies
   */
  async batchTranslate(
    copies: Array<{ label: string; title: string; subtitle?: string }>,
    sourceLocale: string,
    targetLocales: string[],
    appDescription: string
  ): Promise<Record<string, Array<{ title: string; subtitle: string }>>> {
    const results: Record<string, Array<{ title: string; subtitle: string }>> = {};

    for (const locale of targetLocales) {
      if (locale === sourceLocale) {
        // Skip source locale
        continue;
      }

      results[locale] = await this.translateCopies(copies, locale, appDescription);
    }

    return results;
  }
}

/**
 * Singleton instance
 */
let translationServiceInstance: WebTranslationService | null = null;

/**
 * Get translation service instance
 */
export function getTranslationService(): WebTranslationService {
  if (!translationServiceInstance) {
    translationServiceInstance = new WebTranslationService();
  }
  return translationServiceInstance;
}

/**
 * Reset singleton (useful for testing with different API keys)
 */
export function resetTranslationService(): void {
  translationServiceInstance = null;
}
