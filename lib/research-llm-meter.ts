/**
 * Request-scoped counter for Company Research OpenRouter chat completions
 * (Stagehand extract + synthesis / failover / response-healing).
 * Soft-caps at RESEARCH_MAX_OPENROUTER_CALLS so in-flight Stagehand calls
 * cannot push the meter (and Redis decisioning) past the budget.
 */
import { RESEARCH_MAX_OPENROUTER_CALLS } from "@/lib/research-timeouts";

export class ResearchLlmMeter {
  private count = 0;

  increment(n = 1): void {
    const add = Math.max(0, Math.floor(n));
    if (add === 0) return;
    const room = RESEARCH_MAX_OPENROUTER_CALLS - this.count;
    if (room <= 0) return;
    this.count += Math.min(add, room);
  }

  peek(): number {
    return this.count;
  }

  /** True when no further OpenRouter calls should be started. */
  isAtCap(): boolean {
    return this.count >= RESEARCH_MAX_OPENROUTER_CALLS;
  }

  /** Return total since last consume, then reset to 0. */
  consume(): number {
    const n = this.count;
    this.count = 0;
    return n;
  }
}

/** Count OpenRouter chat/completions HTTP round-trips (including healing retries). */
export function createOpenRouterChatCompletionFetch(
  onChatCompletion: () => void,
): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (/\/chat\/completions\b/i.test(url)) {
        onChatCompletion();
      }
    } catch {
      // Never break the AI call for metering.
    }
    return response;
  };
}
