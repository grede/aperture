/**
 * Locale-specific parameter values (US-010)
 */
export interface LocaleData {
  /** Locale code (e.g., en, de, fr, ja) */
  locale: string;
  /** Display name of locale */
  displayName: string;
  /** Parameter name -> value mapping */
  parameters: Record<string, string>;
  /** When this locale data was generated */
  generatedAt: string;
  /** Template hash used for cache invalidation */
  templateHash: string;
  /** Model used for generation */
  model?: string;
  /** Tokens used for generation */
  tokensUsed?: number;
}

/**
 * Configuration for supported locales
 */
export interface LocaleConfig {
  /** Locale code (ISO 639-1 language + optional ISO 3166-1 country) */
  code: string;
  /** Display name */
  displayName: string;
  /** Optional region/country code */
  region?: string;
}

/**
 * Well-known locales with display names
 */
export const KNOWN_LOCALES: LocaleConfig[] = [
  { code: 'en', displayName: 'English', region: 'US' },
  { code: 'de', displayName: 'German', region: 'DE' },
  { code: 'fr', displayName: 'French', region: 'FR' },
  { code: 'es', displayName: 'Spanish', region: 'ES' },
  { code: 'it', displayName: 'Italian', region: 'IT' },
  { code: 'pt', displayName: 'Portuguese', region: 'BR' },
  { code: 'ja', displayName: 'Japanese', region: 'JP' },
  { code: 'ko', displayName: 'Korean', region: 'KR' },
  { code: 'zh', displayName: 'Chinese (Simplified)', region: 'CN' },
  { code: 'zh-TW', displayName: 'Chinese (Traditional)', region: 'TW' },
  { code: 'ru', displayName: 'Russian', region: 'RU' },
  { code: 'ar', displayName: 'Arabic', region: 'SA' },
  { code: 'hi', displayName: 'Hindi', region: 'IN' },
  { code: 'nl', displayName: 'Dutch', region: 'NL' },
  { code: 'sv', displayName: 'Swedish', region: 'SE' },
  { code: 'pl', displayName: 'Polish', region: 'PL' },
];

/**
 * Get locale config by code
 */
export function getLocaleConfig(code: string): LocaleConfig {
  const found = KNOWN_LOCALES.find((l) => l.code === code);
  if (found) return found;

  // Return basic config for unknown locales
  return {
    code,
    displayName: code.toUpperCase(),
  };
}
