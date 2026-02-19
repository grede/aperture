import OpenAI from 'openai';

// ── Character Limits for App Store ────────────────────────────

const APP_STORE_LIMITS = {
  title: 30,       // Recommended max for readability
  subtitle: 170,   // App Store Connect subtitle limit
};

const LOCALE_NAME_MAP: Record<string, string> = {
  ar: 'Arabic',
  de: 'German',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (Australia)',
  'en-CA': 'English (Canada)',
  es: 'Spanish',
  'es-MX': 'Spanish (Mexico)',
  fi: 'Finnish',
  fr: 'French',
  'fr-CA': 'French (Canada)',
  hi: 'Hindi',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ms: 'Malay',
  nl: 'Dutch',
  no: 'Norwegian',
  pl: 'Polish',
  'pt-BR': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  ru: 'Russian',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  'zh-HK': 'Chinese (Hong Kong)',
};

function stripTrailingDot(value: string): string {
  return value.trim().replace(/\.+$/, '').trim();
}

function describeLocale(locale: string): string {
  return `${LOCALE_NAME_MAP[locale] || locale} [${locale}]`;
}

function localeAppealGuidance(locale: string): string {
  const languageCode = locale.split('-')[0].toLowerCase();

  const guidanceByLanguage: Record<string, string> = {
    ru: 'Use polite formal address with "вы" consistently.',
    uk: 'Use polite formal address with "Ви" consistently.',
    de: 'Use formal polite address ("Sie") consistently.',
    fr: 'Use formal/polite address ("vous") consistently.',
    es: 'Use one polite form of address consistently and avoid casual slang.',
    it: 'Use formal polite address ("Lei") consistently.',
    pt: 'Use polite formal register consistently.',
    nl: 'Use polite address ("u") consistently.',
    pl: 'Use a polite formal register consistently.',
    tr: 'Use polite formal address ("siz") consistently.',
  };

  return (
    guidanceByLanguage[languageCode] ||
    'Use one consistent, polite address style throughout this locale.'
  );
}

// ── TranslationService Class ───────────────────────────────────

export class TranslationService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Generate marketing copy for a screenshot in a specific locale
   */
  async generateCopy(
    screenshotLabel: string,
    locale: string,
    appDescription: string,
    screenshotContext: string
  ): Promise<{ title: string; subtitle: string }> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(
      screenshotLabel,
      locale,
      appDescription,
      screenshotContext
    );

    // Build request parameters
    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };

    // Only set temperature for models that support it (o1 and gpt-5 series don't)
    if (!this.model.startsWith('o1-') && !this.model.startsWith('gpt-5')) {
      requestParams.temperature = 0.7; // More creative for compelling copy
    }

    const response = await this.openai.chat.completions.create(requestParams);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const parsed = JSON.parse(content) as { title: string; subtitle: string };
    const result = {
      title: stripTrailingDot(parsed.title || ''),
      subtitle: stripTrailingDot(parsed.subtitle || ''),
    };

    // Validate character limits
    if (result.title.length > APP_STORE_LIMITS.title) {
      console.warn(
        `Warning: Title exceeds recommended ${APP_STORE_LIMITS.title} chars: "${result.title}"`
      );
    }

    // Enforce strict 80 char limit for 2-line display
    const SUBTITLE_DISPLAY_LIMIT = 80;
    if (result.subtitle.length > SUBTITLE_DISPLAY_LIMIT) {
      console.warn(
        `Warning: Subtitle exceeds ${SUBTITLE_DISPLAY_LIMIT} char limit for 2-line display: "${result.subtitle}" (${result.subtitle.length} chars)`
      );
    }

    return result;
  }

  /**
   * Build system prompt for copy generation
   */
  private buildSystemPrompt(): string {
    return `You are a marketing copywriter creating compelling App Store screenshot captions.

Your task:
1. Write short, punchy titles that highlight the key feature shown in the screenshot
2. Write VERY BRIEF subtitles that must fit on 2 lines maximum when displayed
3. Use language that's natural and idiomatic for the target locale, the way native speakers really talk
4. Match the tone to the app's category (productivity = professional, games = exciting, etc.)
5. Respect character limits:
   - Title: ≤ ${APP_STORE_LIMITS.title} characters (recommended for readability)
   - Subtitle: ≤ 80 characters (STRICT - must fit 2 lines visually)
6. Always write copy in the target locale language; never default to English unless locale is English

Respond with JSON:
{
  "title": "Short feature headline",
  "subtitle": "Brief benefit description"
}

Guidelines:
- This is App Store marketing copy: polished, fluent, and persuasive
- If source text is provided, transcreate it for the locale instead of literal word-for-word translation
- Avoid awkward phrasing, calques, and robotic wording
- Keep one consistent form of address/register for the same locale across screenshots
- Title: 3-6 words max, focus on the "what"
- Subtitle: ONE SHORT SENTENCE ONLY (max 80 chars), focus on the key benefit
- Keep subtitle concise and impactful - it must fit 2 lines when rendered
- Do not end title or subtitle with a period (.)
- No emoji unless it's part of app's brand
- No exclamation marks unless truly warranted`;
  }

  /**
   * Build user prompt for copy generation
   */
  private buildUserPrompt(
    screenshotLabel: string,
    locale: string,
    appDescription: string,
    screenshotContext: string
  ): string {
    return `Generate marketing copy for this screenshot:

App: ${appDescription}
Screenshot: ${screenshotLabel}
Context: ${screenshotContext}
Target locale: ${describeLocale(locale)}

Write compelling title and subtitle in ${locale} that highlight what makes this screen special.
Make wording sound native and natural for everyday speakers in ${locale}.
Prioritize App Store-quality transcreation over literal translation.
Address/register rule: ${localeAppealGuidance(locale)}
Important: Locale code "uk" means Ukrainian language, not English (UK).
Respond with JSON containing "title" and "subtitle" keys.`;
  }
}
