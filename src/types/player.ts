/**
 * Step execution result
 */
export interface StepResult {
  stepIndex: number;
  status: StepStatus;
  duration: number;
  error?: string;
  selectorUsed?: string;
  usedAIFallback?: boolean;
}

/**
 * Step execution status
 */
export type StepStatus = 'success' | 'failed' | 'skipped' | 'timeout';

/**
 * Playback result for entire recording
 */
export interface PlaybackResult {
  recordingId: string;
  locale?: string;
  steps: StepResult[];
  screenshots: string[];
  startTime: number;
  endTime: number;
  duration: number;
  successCount: number;
  failureCount: number;
  aiFallbackCount: number;
}

/**
 * Resolved element selector with metadata
 */
export interface ResolvedSelector {
  selector: string;
  method: SelectorMethod;
  usedAIFallback: boolean;
  confidence?: number;
}

/**
 * Selector resolution method
 */
export type SelectorMethod =
  | 'cached'
  | 'accessibilityId'
  | 'accessibilityLabel'
  | 'label'
  | 'xpath'
  | 'ai-fallback';

/**
 * Selector cache entry
 */
export interface SelectorCacheEntry {
  stepIndex: number;
  originalSelector: string;
  resolvedSelector: string;
  method: SelectorMethod;
  timestamp: number;
}

/**
 * Selector cache for a recording
 */
export interface SelectorCache {
  recordingId: string;
  locale?: string;
  templateHash: string;
  entries: SelectorCacheEntry[];
  createdAt: string;
  updatedAt: string;
}
