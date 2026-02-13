import type { Recording } from './recording.js';

/**
 * Parameter definition identified by AI
 */
export interface Parameter {
  /** Parameter name (e.g., user_name, email) */
  name: string;
  /** Original hardcoded value from recording */
  originalValue: string;
  /** Step index where this parameter is used */
  stepIndex: number;
  /** Parameter description for context */
  description?: string;
  /** Category hint (name, email, phone, etc.) */
  category?: 'name' | 'email' | 'phone' | 'text' | 'number' | 'date' | 'other';
}

/**
 * Parameterized recording template
 */
export interface Template {
  /** Template ID (matches original recording ID) */
  id: string;
  /** Template name */
  name: string;
  /** Original recording this template was created from */
  baseRecordingId: string;
  /** Bundle ID of the app */
  bundleId: string;
  /** Identified parameters */
  parameters: Parameter[];
  /** Recording data with {{parameter}} placeholders */
  recording: Recording;
  /** When this template was created */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;
  /** Hash of recording for cache invalidation */
  recordingHash: string;
}

/**
 * AI parameterization suggestion
 */
export interface ParameterSuggestion {
  /** Suggested parameter name */
  suggestedName: string;
  /** Original value found in recording */
  originalValue: string;
  /** Step index */
  stepIndex: number;
  /** AI's reasoning for this suggestion */
  reasoning: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Suggested category */
  category: Parameter['category'];
}

/**
 * Parameterization result from AI analysis
 */
export interface ParameterizationResult {
  /** Original recording that was analyzed */
  recording: Recording;
  /** AI-suggested parameters */
  suggestions: ParameterSuggestion[];
  /** Total tokens used in AI call */
  tokensUsed?: number;
  /** Model used for analysis */
  model: string;
}
