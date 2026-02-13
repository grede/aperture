import fs from 'fs/promises';
import path from 'path';
import { aiClient } from '../utils/ai-client.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Translation data for a locale
 */
export interface LocaleTranslations {
  /** Locale code */
  locale: string;
  /** Template hash for cache invalidation */
  templateHash: string;
  /** Screenshot label → localized marketing copy */
  copy: Record<string, ScreenshotCopy>;
  /** When this was generated */
  generatedAt: string;
}

/**
 * Marketing copy for a single screenshot
 */
export interface ScreenshotCopy {
  /** Main title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Base English copy this was adapted from */
  baseEnglish: string;
}

/**
 * Base copy provided by user for a screenshot
 */
export interface BaseScreenshotCopy {
  /** Screenshot label/name */
  label: string;
  /** English title */
  title: string;
  /** Optional English subtitle */
  subtitle?: string;
}

/**
 * Translation service for generating localized marketing copy (US-018)
 */
export class TranslationService {
  private translationsDir = 'translations';

  /**
   * Generate translations for all screenshots × locales
   */
  async generateAll(
    baseCopy: BaseScreenshotCopy[],
    locales: string[],
    templateHash: string,
    force: boolean = false
  ): Promise<Map<string, LocaleTranslations>> {
    const results = new Map<string, LocaleTranslations>();

    logger.info(
      { screenshotCount: baseCopy.length, locales: locales.length, force },
      'Starting translation generation'
    );

    for (const locale of locales) {
      // Check if translations already exist
      if (!force) {
        const existing = await this.loadTranslations(locale);
        if (existing && existing.templateHash === templateHash) {
          logger.info({ locale }, 'Using cached translations');
          results.set(locale, existing);
          continue;
        }
      }

      // Generate new translations
      logger.info({ locale }, 'Generating translations via GPT-4o-mini');
      const translations = await this.generateForLocale(baseCopy, locale, templateHash);
      results.set(locale, translations);

      // Save translations
      await this.saveTranslations(translations);
    }

    logger.info({ locales: results.size }, 'Translation generation completed');
    return results;
  }

  /**
   * Generate translations for a single locale
   */
  private async generateForLocale(
    baseCopy: BaseScreenshotCopy[],
    locale: string,
    templateHash: string
  ): Promise<LocaleTranslations> {
    // Build AI prompt
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(baseCopy, locale);

    // Call GPT-4o-mini
    const response = await aiClient.complete({
      systemPrompt,
      userPrompt,
      temperature: 0.7, // Higher temperature for creative marketing copy
      responseFormat: 'json',
    });

    // Parse response
    const aiResponse = aiClient.parseJSON<{
      screenshots: Array<{
        label: string;
        title: string;
        subtitle?: string;
      }>;
    }>(response.content);

    // Build LocaleTranslations
    const copy: Record<string, ScreenshotCopy> = {};
    for (let i = 0; i < baseCopy.length; i++) {
      const base = baseCopy[i];
      const adapted = aiResponse.screenshots[i];

      copy[base.label] = {
        title: adapted.title,
        subtitle: adapted.subtitle,
        baseEnglish: `${base.title}${base.subtitle ? ` - ${base.subtitle}` : ''}`,
      };
    }

    return {
      locale,
      templateHash,
      copy,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build system prompt for translation AI
   */
  private buildSystemPrompt(): string {
    return `You are an expert marketing copywriter and translator specializing in app store screenshots.

Your task is to adapt English marketing copy for app screenshots into target languages. This is NOT literal translation - you should:

1. **Adapt for cultural context**: Use language and phrasing that resonates with the target market
2. **Maintain marketing tone**: Keep the persuasive, benefit-focused language
3. **Be concise**: App store screenshots have limited space - keep copy punchy
4. **Preserve meaning**: While adapting, ensure the core message stays the same
5. **Use native expressions**: Don't translate idioms literally - use equivalent local expressions

Return your response as JSON with this structure:
{
  "screenshots": [
    {
      "label": "screenshot-1",
      "title": "Adapted title in target language",
      "subtitle": "Adapted subtitle in target language (optional)"
    },
    ...
  ]
}`;
  }

  /**
   * Build user prompt with base copy and target locale
   */
  private buildUserPrompt(baseCopy: BaseScreenshotCopy[], locale: string): string {
    const localeNames: Record<string, string> = {
      en: 'English',
      de: 'German',
      fr: 'French',
      es: 'Spanish',
      it: 'Italian',
      pt: 'Portuguese',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese (Simplified)',
      'zh-Hant': 'Chinese (Traditional)',
      ru: 'Russian',
      ar: 'Arabic',
      hi: 'Hindi',
      nl: 'Dutch',
      sv: 'Swedish',
      pl: 'Polish',
      tr: 'Turkish',
    };

    const localeName = localeNames[locale] || locale;

    let prompt = `Please adapt the following app store screenshot marketing copy into ${localeName}.\n\n`;
    prompt += `Remember: This is marketing adaptation, not literal translation. Use language that sells well in ${localeName} markets.\n\n`;
    prompt += `Screenshots to adapt:\n\n`;

    for (const screenshot of baseCopy) {
      prompt += `**${screenshot.label}**:\n`;
      prompt += `- Title: "${screenshot.title}"\n`;
      if (screenshot.subtitle) {
        prompt += `- Subtitle: "${screenshot.subtitle}"\n`;
      }
      prompt += `\n`;
    }

    prompt += `\nRespond with JSON containing adapted copy for all screenshots.`;

    return prompt;
  }

  /**
   * Load existing translations for a locale
   */
  async loadTranslations(locale: string): Promise<LocaleTranslations | null> {
    try {
      const filepath = this.getTranslationsPath(locale);
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Save translations to file
   */
  private async saveTranslations(translations: LocaleTranslations): Promise<void> {
    const filepath = this.getTranslationsPath(translations.locale);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(translations, null, 2));
    logger.info({ locale: translations.locale, filepath }, 'Translations saved');
  }

  /**
   * Get file path for locale translations
   */
  private getTranslationsPath(locale: string): string {
    return path.join(this.translationsDir, `${locale}.json`);
  }

  /**
   * Compute hash for base copy (for cache validation)
   */
  static hashBaseCopy(baseCopy: BaseScreenshotCopy[]): string {
    const content = JSON.stringify(baseCopy);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

export const translationService = new TranslationService();
