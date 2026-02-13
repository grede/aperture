import OpenAI from 'openai';
import { logger } from './logger.js';

/**
 * OpenAI API client configuration
 */
export interface AIClientConfig {
  apiKey?: string;
  model?: string;
  fallbackModel?: string;
  maxTokens?: number;
}

/**
 * AI completion request
 */
export interface AICompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  responseFormat?: 'json' | 'text';
}

/**
 * AI completion response
 */
export interface AICompletionResponse {
  content: string;
  model: string;
  tokensUsed: number;
  finishReason: string;
}

/**
 * Singleton OpenAI client for consistent API usage across the application
 */
class AIClient {
  private client: OpenAI | null = null;
  private config: Required<AIClientConfig>;

  constructor() {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
      fallbackModel: 'gpt-4o',
      maxTokens: 1000,
    };
  }

  /**
   * Initialize the client with configuration
   */
  initialize(config: AIClientConfig = {}) {
    this.config = {
      ...this.config,
      ...config,
    };

    if (!this.config.apiKey) {
      logger.warn('OpenAI API key not configured. AI features will be disabled.');
      return;
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    });

    logger.info({ model: this.config.model }, 'AI client initialized');
  }

  /**
   * Check if AI client is ready
   */
  isReady(): boolean {
    return this.client !== null && this.config.apiKey.length > 0;
  }

  /**
   * Get a completion from OpenAI with automatic fallback
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.isReady()) {
      throw new Error('AI client not initialized or API key missing');
    }

    try {
      return await this.tryCompletion(request, this.config.model);
    } catch (error) {
      // Fallback to the alternative model if primary fails
      if (this.config.fallbackModel && this.config.fallbackModel !== this.config.model) {
        logger.warn(
          { primaryModel: this.config.model, fallbackModel: this.config.fallbackModel, error },
          'Primary model failed, trying fallback'
        );
        return await this.tryCompletion(request, this.config.fallbackModel);
      }
      throw error;
    }
  }

  /**
   * Try completion with specific model
   */
  private async tryCompletion(
    request: AICompletionRequest,
    model: string
  ): Promise<AICompletionResponse> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ];

    const completionOptions: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: this.config.maxTokens,
    };

    // Add response format if JSON requested
    if (request.responseFormat === 'json') {
      completionOptions.response_format = { type: 'json_object' };
    }

    logger.debug({ model, promptLength: request.userPrompt.length }, 'Sending AI completion request');

    const response = await this.client!.chat.completions.create(completionOptions);

    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error('No response from AI model');
    }

    const result: AICompletionResponse = {
      content: choice.message.content,
      model: response.model,
      tokensUsed: response.usage?.total_tokens ?? 0,
      finishReason: choice.finish_reason,
    };

    logger.debug(
      { model: result.model, tokensUsed: result.tokensUsed, finishReason: result.finishReason },
      'AI completion received'
    );

    return result;
  }

  /**
   * Parse JSON response with error handling
   */
  parseJSON<T>(content: string): T {
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      logger.error({ content, error }, 'Failed to parse AI JSON response');
      throw new Error(`Invalid JSON response from AI: ${(error as Error).message}`);
    }
  }
}

/**
 * Singleton instance
 */
export const aiClient = new AIClient();
