import type { CostSummary } from '../types/index.js';

// ── Pricing Constants (as of Jan 2025) ────────────────────────

const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': {
    prompt: 2.5 / 1_000_000, // $2.50 per 1M input tokens
    completion: 10.0 / 1_000_000, // $10.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    prompt: 0.15 / 1_000_000, // $0.15 per 1M input tokens
    completion: 0.6 / 1_000_000, // $0.60 per 1M output tokens
  },
  'gpt-4': {
    prompt: 30.0 / 1_000_000, // $30.00 per 1M input tokens
    completion: 60.0 / 1_000_000, // $60.00 per 1M output tokens
  },
  'gpt-3.5-turbo': {
    prompt: 0.5 / 1_000_000, // $0.50 per 1M input tokens
    completion: 1.5 / 1_000_000, // $1.50 per 1M output tokens
  },
};

interface UsageRecord {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

// ── CostTracker Class ──────────────────────────────────────────

export class CostTracker {
  private records: UsageRecord[] = [];

  /**
   * Record token usage from an LLM API call
   */
  record(model: string, promptTokens: number, completionTokens: number): void {
    const pricing = MODEL_PRICING[model];

    if (!pricing) {
      console.warn(`Unknown model: ${model}, using gpt-4o-mini pricing as fallback`);
      model = 'gpt-4o-mini';
    }

    const cost =
      (pricing?.prompt ?? MODEL_PRICING['gpt-4o-mini'].prompt) * promptTokens +
      (pricing?.completion ?? MODEL_PRICING['gpt-4o-mini'].completion) * completionTokens;

    this.records.push({
      model,
      promptTokens,
      completionTokens,
      cost,
    });
  }

  /**
   * Get total cost across all recorded calls
   */
  getTotalCost(): number {
    return this.records.reduce((sum, record) => sum + record.cost, 0);
  }

  /**
   * Get total token counts
   */
  getTotalTokens(): { prompt: number; completion: number } {
    return this.records.reduce(
      (totals, record) => ({
        prompt: totals.prompt + record.promptTokens,
        completion: totals.completion + record.completionTokens,
      }),
      { prompt: 0, completion: 0 }
    );
  }

  /**
   * Get cost summary breakdown by model
   */
  getSummary(): CostSummary {
    const byModel = new Map<string, { calls: number; tokens: number; cost: number }>();

    for (const record of this.records) {
      const existing = byModel.get(record.model) ?? { calls: 0, tokens: 0, cost: 0 };

      byModel.set(record.model, {
        calls: existing.calls + 1,
        tokens: existing.tokens + record.promptTokens + record.completionTokens,
        cost: existing.cost + record.cost,
      });
    }

    return {
      totalCost: this.getTotalCost(),
      breakdown: Array.from(byModel.entries()).map(([model, stats]) => ({
        model,
        ...stats,
      })),
    };
  }

  /**
   * Check if total cost exceeds the budget cap
   */
  isOverBudget(capUsd: number): boolean {
    return this.getTotalCost() > capUsd;
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.records = [];
  }

  /**
   * Get formatted cost string (e.g., "$0.0234")
   */
  getFormattedCost(): string {
    return `$${this.getTotalCost().toFixed(4)}`;
  }

  /**
   * Get estimated cost for a given token count and model
   */
  static estimateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o-mini'];
    return pricing.prompt * promptTokens + pricing.completion * completionTokens;
  }
}
