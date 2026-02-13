import { logger } from './logger.js';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of attempts (including first try) */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Function to determine if error should trigger retry */
  shouldRetry?: (error: Error) => boolean;
  /** Callback before each retry */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
        throw lastError;
      }

      // If this was the last attempt, throw
      if (attempt === opts.maxAttempts) {
        logger.error(
          { attempt, maxAttempts: opts.maxAttempts, error: lastError },
          'All retry attempts failed'
        );
        throw lastError;
      }

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt, lastError);
      }

      logger.warn(
        { attempt, maxAttempts: opts.maxAttempts, delay, error: lastError.message },
        'Retrying after error'
      );

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with linear backoff (constant delay)
 */
export async function retryLinear<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs = 1000
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    initialDelay: delayMs,
    backoffMultiplier: 1, // No exponential growth
  });
}

/**
 * Retry until a condition is met or timeout
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: {
    timeout: number;
    interval?: number;
    timeoutMessage?: string;
  }
): Promise<T> {
  const { timeout, interval = 1000, timeoutMessage = 'Operation timed out' } = options;
  const startTime = Date.now();

  while (true) {
    const result = await fn();

    if (condition(result)) {
      return result;
    }

    if (Date.now() - startTime >= timeout) {
      throw new Error(timeoutMessage);
    }

    await sleep(interval);
  }
}
