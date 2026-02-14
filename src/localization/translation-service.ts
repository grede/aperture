import OpenAI from 'openai';

// ── Character Limits for App Store ────────────────────────────

const APP_STORE_LIMITS = {
  title: 30,       // Recommended max for readability
  subtitle: 170,   // App Store Connect subtitle limit
};

// ── TranslationService Class ───────────────────────────────────

export class TranslationService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
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

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7, // More creative for compelling copy
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const result = JSON.parse(content) as { title: string; subtitle: string };

    // Validate character limits
    if (result.title.length > APP_STORE_LIMITS.title) {
      console.warn(
        `Warning: Title exceeds recommended ${APP_STORE_LIMITS.title} chars: "${result.title}"`
      );
    }

    if (result.subtitle.length > APP_STORE_LIMITS.subtitle) {
      console.warn(
        `Warning: Subtitle exceeds ${APP_STORE_LIMITS.subtitle} char limit: "${result.subtitle}"`
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
2. Write engaging subtitles that expand on the benefit or use case
3. Use language that's natural and idiomatic for the target locale
4. Match the tone to the app's category (productivity = professional, games = exciting, etc.)
5. Respect character limits:
   - Title: ≤ ${APP_STORE_LIMITS.title} characters (recommended for readability)
   - Subtitle: ≤ ${APP_STORE_LIMITS.subtitle} characters (App Store limit)

Respond with JSON:
{
  "title": "Short feature headline",
  "subtitle": "Longer benefit-focused description"
}

Guidelines:
- Title: 3-6 words max, focus on the "what"
- Subtitle: 1-2 sentences, focus on the "why" or "how"
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
Locale: ${locale}

Write compelling title and subtitle in ${locale} that highlight what makes this screen special.
Respond with JSON containing "title" and "subtitle" keys.`;
  }
}
