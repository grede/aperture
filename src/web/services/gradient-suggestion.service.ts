/**
 * Gradient suggestion service for template background colors
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { ensureWebEnvLoaded } from '../lib/env';
import { hexColorSchema } from '../lib/validators';

ensureWebEnvLoaded();

const suggestedGradientSchema = z
  .object({
    from: hexColorSchema,
    to: hexColorSchema,
  })
  .strict();

function resolveVisionModel(): string {
  const configuredModel =
    process.env.LLM_VISION_MODEL?.trim() || process.env.LLM_MODEL?.trim() || 'gpt-4o';

  if (configuredModel.startsWith('o1-')) {
    return 'gpt-4o';
  }

  if (configuredModel.startsWith('gpt-5')) {
    return 'gpt-5.1';
  }

  return configuredModel;
}

export class GradientSuggestionService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey?: string) {
    const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (!resolvedApiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    this.openai = new OpenAI({ apiKey: resolvedApiKey });
    this.model = resolveVisionModel();
  }

  async suggestGradientColors(input: {
    screenshotBase64: string;
    appName?: string;
    appDescription?: string;
  }): Promise<{ from: string; to: string }> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert mobile UI color designer.

Suggest exactly two hex colors for a gradient background that matches the screenshot's visual palette.

Rules:
- Return JSON only: {"from":"#RRGGBB","to":"#RRGGBB"}
- Use uppercase 6-digit hex colors
- Colors must be distinct and visually harmonious
- Avoid pure black (#000000) and pure white (#FFFFFF)
- Prioritize colors that complement the screenshot while keeping strong marketing visual impact`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Suggest two gradient colors for this app screenshot.
App name: ${input.appName || 'Unknown'}
App description: ${input.appDescription || 'Not provided'}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${input.screenshotBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const parsed = JSON.parse(content) as { from?: string; to?: string };
    const suggestion = suggestedGradientSchema.parse({
      from: parsed.from?.toUpperCase(),
      to: parsed.to?.toUpperCase(),
    });

    if (suggestion.from === suggestion.to) {
      throw new Error('AI suggested identical colors. Please try again.');
    }

    return suggestion;
  }
}

let gradientSuggestionServiceInstance: GradientSuggestionService | null = null;

export function getGradientSuggestionService(): GradientSuggestionService {
  if (!gradientSuggestionServiceInstance) {
    gradientSuggestionServiceInstance = new GradientSuggestionService();
  }
  return gradientSuggestionServiceInstance;
}

export function resetGradientSuggestionService(): void {
  gradientSuggestionServiceInstance = null;
}
