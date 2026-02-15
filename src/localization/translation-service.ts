import OpenAI from 'openai';

// ── Character Limits for App Store ────────────────────────────

const APP_STORE_LIMITS = {
  title: 30,       // Recommended max for readability
  subtitle: 170,   // App Store Connect subtitle limit
};

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

    const result = JSON.parse(content) as { title: string; subtitle: string };

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
3. Use language that's natural and idiomatic for the target locale
4. Match the tone to the app's category (productivity = professional, games = exciting, etc.)
5. Respect character limits:
   - Title: ≤ ${APP_STORE_LIMITS.title} characters (recommended for readability)
   - Subtitle: ≤ 80 characters (STRICT - must fit 2 lines visually)

Respond with JSON:
{
  "title": "Short feature headline",
  "subtitle": "Brief benefit description"
}

Guidelines:
- Title: 3-6 words max, focus on the "what"
- Subtitle: ONE SHORT SENTENCE ONLY (max 80 chars), focus on the key benefit
- Keep subtitle concise and impactful - it must fit 2 lines when rendered
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
