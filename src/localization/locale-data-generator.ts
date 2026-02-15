import OpenAI from 'openai';

// ── Data Schema Types ──────────────────────────────────────────

export interface DataSchema {
  variables: Array<{
    name: string;
    description: string;
    type: 'name' | 'text' | 'number' | 'date' | 'address' | 'custom';
  }>;
}

// ── LocaleDataGenerator Class ──────────────────────────────────

export class LocaleDataGenerator {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Generate culturally appropriate test data for a specific locale
   */
  async generate(schema: DataSchema, locale: string): Promise<Record<string, string>> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(schema, locale);

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
      requestParams.temperature = 0.7; // More creative for diverse data
    }

    const response = await this.openai.chat.completions.create(requestParams);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const result = JSON.parse(content) as Record<string, string>;

    // Validate all required variables are present
    for (const variable of schema.variables) {
      if (!(variable.name in result)) {
        throw new Error(`LLM did not generate value for variable: ${variable.name}`);
      }
    }

    return result;
  }

  /**
   * Build system prompt for data generation
   */
  private buildSystemPrompt(): string {
    return `You are a localization expert generating culturally appropriate test data for app screenshots.

Your task:
1. Generate realistic, culturally appropriate values for each variable
2. Ensure names, addresses, dates, and content feel authentic for the target locale
3. Use appropriate formatting (date formats, number formats, etc.) for the locale
4. For names: use common names from that culture
5. For addresses: use real city/street name patterns from that region
6. For dates: use culturally appropriate date formats
7. For text: use natural, idiomatic phrases

Respond with JSON containing the variable names as keys and generated values.

Example for German (de):
{
  "user_name": "Müller",
  "group_name": "Familiengruppe",
  "address": "Hauptstraße 42, München",
  "date": "14.02.2026"
}`;
  }

  /**
   * Build user prompt for data generation
   */
  private buildUserPrompt(schema: DataSchema, locale: string): string {
    const variableList = schema.variables
      .map((v) => `- ${v.name} (${v.type}): ${v.description}`)
      .join('\n');

    return `Generate test data for locale: ${locale}

Variables to generate:
${variableList}

Respond with JSON containing these exact variable names as keys and culturally appropriate values for ${locale}.`;
  }
}
