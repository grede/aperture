import type { Recording, Step } from '../types/recording.js';
import type {
  Template,
  Parameter,
  ParameterSuggestion,
  ParameterizationResult,
} from '../types/template.js';
import { aiClient } from '../utils/ai-client.js';
import { logger } from '../utils/logger.js';
import { sha256 } from '../utils/hash.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * AI-powered parameterization of recordings (US-009)
 */
export class Parameterizer {
  private templatesDir = 'templates';

  /**
   * Analyze a recording and suggest parameters
   */
  async analyze(recording: Recording): Promise<ParameterizationResult> {
    logger.info({ recordingId: recording.id }, 'Starting parameterization analysis');

    // Extract all text input steps
    const textInputSteps = recording.steps.filter((step) => step.action === 'type' && step.value);

    if (textInputSteps.length === 0) {
      logger.warn('No text input steps found in recording');
      return {
        recording,
        suggestions: [],
        model: 'none',
      };
    }

    // Build AI prompt
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(textInputSteps, recording);

    // Get AI suggestions
    const response = await aiClient.complete({
      systemPrompt,
      userPrompt,
      temperature: 0.3, // Lower temperature for more consistent suggestions
      responseFormat: 'json',
    });

    // Parse AI response
    const aiResponse = aiClient.parseJSON<{
      suggestions: Array<{
        stepIndex: number;
        originalValue: string;
        suggestedName: string;
        reasoning: string;
        confidence: number;
        category: string;
      }>;
    }>(response.content);

    // Convert to ParameterSuggestion format
    const suggestions: ParameterSuggestion[] = aiResponse.suggestions.map((s) => ({
      stepIndex: s.stepIndex,
      originalValue: s.originalValue,
      suggestedName: s.suggestedName,
      reasoning: s.reasoning,
      confidence: s.confidence,
      category: this.normalizeCategory(s.category),
    }));

    logger.info(
      { suggestionsCount: suggestions.length, tokensUsed: response.tokensUsed },
      'Parameterization analysis complete'
    );

    return {
      recording,
      suggestions,
      tokensUsed: response.tokensUsed,
      model: response.model,
    };
  }

  /**
   * Create a template from user-confirmed parameters
   */
  async createTemplate(
    recording: Recording,
    confirmedParameters: Parameter[]
  ): Promise<Template> {
    logger.info({ recordingId: recording.id, paramCount: confirmedParameters.length }, 'Creating template');

    // Create a copy of the recording with parameterized values
    const parameterizedRecording = JSON.parse(JSON.stringify(recording)) as Recording;

    // Replace values with {{parameter}} placeholders
    for (const param of confirmedParameters) {
      const step = parameterizedRecording.steps.find((s) => s.index === param.stepIndex);
      if (step && step.value) {
        step.value = `{{${param.name}}}`;
      }
    }

    // Compute recording hash for cache invalidation
    const recordingHash = sha256(JSON.stringify(recording));

    const template: Template = {
      id: `tpl-${recording.id}`,
      name: recording.name,
      baseRecordingId: recording.id,
      bundleId: recording.bundleId,
      parameters: confirmedParameters,
      recording: parameterizedRecording,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recordingHash,
    };

    // Save template
    await this.saveTemplate(template);

    logger.info({ templateId: template.id }, 'Template created');

    return template;
  }

  /**
   * Save template to disk
   */
  async saveTemplate(template: Template): Promise<void> {
    await fs.mkdir(this.templatesDir, { recursive: true });
    const filepath = path.join(this.templatesDir, `${template.name}.json`);
    await fs.writeFile(filepath, JSON.stringify(template, null, 2));
    logger.debug({ filepath }, 'Template saved');
  }

  /**
   * Load template from disk
   */
  async loadTemplate(name: string): Promise<Template> {
    const filepath = path.join(this.templatesDir, `${name}.json`);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content) as Template;
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(): string {
    return `You are an expert at analyzing mobile app UI automation recordings to identify test data that should be parameterized for localization.

Your task is to analyze a sequence of text input actions from an iOS app recording and identify which values should be replaced with parameters for multi-locale testing.

Guidelines:
- Parameters should represent data that varies by locale (names, emails, phone numbers, addresses, etc.)
- Don't parameterize UI text or commands (those are handled by the app's own localization)
- Suggest clear, descriptive parameter names using snake_case (e.g., user_name, email_address)
- Provide reasoning for each suggestion
- Assign a confidence score 0.0-1.0 for each suggestion
- Categorize each parameter: name, email, phone, text, number, date, other

Return your analysis as JSON in this format:
{
  "suggestions": [
    {
      "stepIndex": 0,
      "originalValue": "John Smith",
      "suggestedName": "user_name",
      "reasoning": "This appears to be a user's full name in a registration form",
      "confidence": 0.95,
      "category": "name"
    }
  ]
}`;
  }

  /**
   * Build user prompt with text input steps
   */
  private buildUserPrompt(textInputSteps: Step[], recording: Recording): string {
    const stepsText = textInputSteps
      .map((step) => {
        return `Step ${step.index}: "${step.value}" (typed into ${step.selector.accessibilityIdentifier || step.selector.label || 'unknown field'})`;
      })
      .join('\n');

    return `Analyze these text input actions from an iOS app recording and suggest which values should be parameterized for multi-locale testing:

Recording: ${recording.name}
App: ${recording.bundleId}

Text Input Steps:
${stepsText}

Please suggest parameters for values that should vary by locale. Return your analysis as JSON.`;
  }

  /**
   * Normalize category string to known types
   */
  private normalizeCategory(
    category: string
  ): 'name' | 'email' | 'phone' | 'text' | 'number' | 'date' | 'other' {
    const normalized = category.toLowerCase();
    if (['name', 'email', 'phone', 'text', 'number', 'date'].includes(normalized)) {
      return normalized as 'name' | 'email' | 'phone' | 'text' | 'number' | 'date';
    }
    return 'other';
  }
}

export const parameterizer = new Parameterizer();
