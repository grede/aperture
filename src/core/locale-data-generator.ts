import type { Template } from '../types/template.js';
import type { LocaleData, LocaleConfig } from '../types/locale.js';
import { getLocaleConfig } from '../types/locale.js';
import { aiClient } from '../utils/ai-client.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate locale-specific test data using AI (US-010)
 */
export class LocaleDataGenerator {
  private localesDir = 'locales';

  /**
   * Generate test data for a single locale
   */
  async generate(template: Template, localeCode: string): Promise<LocaleData> {
    logger.info({ templateId: template.id, locale: localeCode }, 'Generating locale data');

    const localeConfig = getLocaleConfig(localeCode);

    if (template.parameters.length === 0) {
      logger.warn('Template has no parameters, creating empty locale data');
      return {
        locale: localeCode,
        displayName: localeConfig.displayName,
        parameters: {},
        generatedAt: new Date().toISOString(),
        templateHash: template.recordingHash,
      };
    }

    // Build AI prompt
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(template, localeConfig);

    // Get AI-generated data
    const response = await aiClient.complete({
      systemPrompt,
      userPrompt,
      temperature: 0.8, // Higher temperature for more variety
      responseFormat: 'json',
    });

    // Parse AI response
    const aiResponse = aiClient.parseJSON<{
      parameters: Record<string, string>;
    }>(response.content);

    const localeData: LocaleData = {
      locale: localeCode,
      displayName: localeConfig.displayName,
      parameters: aiResponse.parameters,
      generatedAt: new Date().toISOString(),
      templateHash: template.recordingHash,
      model: response.model,
      tokensUsed: response.tokensUsed,
    };

    logger.info(
      { locale: localeCode, paramCount: Object.keys(aiResponse.parameters).length, tokensUsed: response.tokensUsed },
      'Locale data generated'
    );

    return localeData;
  }

  /**
   * Generate test data for multiple locales
   */
  async generateForLocales(template: Template, localeCodes: string[]): Promise<LocaleData[]> {
    const results: LocaleData[] = [];

    for (const localeCode of localeCodes) {
      const localeData = await this.generate(template, localeCode);
      await this.saveLocaleData(localeData);
      results.push(localeData);
    }

    return results;
  }

  /**
   * Save locale data to disk
   */
  async saveLocaleData(data: LocaleData): Promise<void> {
    await fs.mkdir(this.localesDir, { recursive: true });
    const filepath = path.join(this.localesDir, `${data.locale}.json`);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    logger.debug({ filepath }, 'Locale data saved');
  }

  /**
   * Load locale data from disk
   */
  async loadLocaleData(localeCode: string): Promise<LocaleData | null> {
    try {
      const filepath = path.join(this.localesDir, `${localeCode}.json`);
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content) as LocaleData;
    } catch {
      return null;
    }
  }

  /**
   * Check if locale data exists and is valid for template
   */
  async isValid(localeCode: string, templateHash: string): Promise<boolean> {
    const data = await this.loadLocaleData(localeCode);
    if (!data) return false;
    return data.templateHash === templateHash;
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(): string {
    return `You are an expert at generating culturally appropriate test data for mobile app localization testing.

Your task is to generate realistic test data values for parameters based on the target locale. The data should:
- Be culturally appropriate for the locale (use local names, formats, conventions)
- Be realistic but generic (avoid real people or trademarked entities)
- Be consistent within the locale (same person name across all parameters)
- Follow local formatting conventions (phone numbers, dates, addresses, etc.)

Examples:
- For German (de): Use German names like "Max Müller", German phone format "+49 30 12345678"
- For Japanese (ja): Use Japanese names in proper order "田中太郎", Japanese phone format "03-1234-5678"
- For English (en): Use common English names like "John Smith", US phone format "(555) 123-4567"

Return your data as JSON with parameter names as keys and generated values as strings:
{
  "parameters": {
    "user_name": "culturally appropriate name",
    "email": "culturally appropriate email",
    "phone": "properly formatted phone number"
  }
}`;
  }

  /**
   * Build user prompt with template context
   */
  private buildUserPrompt(template: Template, localeConfig: LocaleConfig): string {
    const parametersText = template.parameters
      .map((p) => {
        return `- ${p.name} (${p.category}): originally "${p.originalValue}"${p.description ? ` - ${p.description}` : ''}`;
      })
      .join('\n');

    return `Generate culturally appropriate test data for the following parameters:

Locale: ${localeConfig.displayName} (${localeConfig.code})${localeConfig.region ? `, Region: ${localeConfig.region}` : ''}
App: ${template.bundleId}

Parameters:
${parametersText}

Please generate realistic values for each parameter that would be appropriate for a ${localeConfig.displayName}-speaking user. Ensure consistency (e.g., if generating a name, use the same person throughout). Return as JSON.`;
  }
}

export const localeDataGenerator = new LocaleDataGenerator();
