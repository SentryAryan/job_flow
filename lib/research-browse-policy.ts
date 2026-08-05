import type { HomepageExtract } from "@/agent/research-schemas";

/** Leave headroom for OpenRouter dossier synthesis after browse. */
export const RESEARCH_SYNTHESIS_RESERVE_MS = 90_000;

/** True when homepage already has solid employer signals (optional sub-page skip). */
export function isHomepageExtractRichEnough(
  extract: HomepageExtract,
): boolean {
  const signals = extract.signals.filter((s) => s.trim().length > 0);
  return (
    extract.oneLiner.trim().length >= 40 &&
    extract.productSummary.trim().length >= 80 &&
    signals.length >= 3
  );
}

export function remainingResearchMs(
  deadlineAt: number,
  nowMs = Date.now(),
): number {
  return Math.max(0, deadlineAt - nowMs);
}

/**
 * Whether we can still start a sub-page extract without starving synthesis.
 * When `includeRetryBudget` is true, require room for one timeout retry.
 */
export function canAttemptSubPageExtract(options: {
  remainingMs: number;
  gotoMs: number;
  extractMs: number;
  synthesisReserveMs?: number;
  includeRetryBudget?: boolean;
}): boolean {
  const reserve =
    options.synthesisReserveMs ?? RESEARCH_SYNTHESIS_RESERVE_MS;
  const extractBudget = options.includeRetryBudget
    ? options.extractMs * 2
    : options.extractMs;
  return (
    options.remainingMs >= options.gotoMs + extractBudget + reserve
  );
}

/**
 * Skip sub-page when homepage is already rich AND remaining time cannot
 * cover even one extract attempt (prefer finishing synthesis).
 * Does not require a full retry budget — that was skipping About pages with
 * minutes of headroom when EXTRACT_TIMEOUT is large (e.g. 300s).
 */
export function shouldSkipSubPageBecauseHomepageRich(options: {
  extract: HomepageExtract;
  remainingMs: number;
  gotoMs: number;
  extractMs: number;
}): boolean {
  if (!isHomepageExtractRichEnough(options.extract)) return false;
  return !canAttemptSubPageExtract({
    remainingMs: options.remainingMs,
    gotoMs: options.gotoMs,
    extractMs: options.extractMs,
    includeRetryBudget: false,
  });
}

export function isResearchTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out/i.test(error.message);
}

/**
 * Run an extract once; on timeout, retry up to `retries` extra times.
 */
export async function withExtractRetry<T>(
  run: () => Promise<T>,
  options?: {
    retries?: number;
    onRetry?: (attempt: number) => void;
  },
): Promise<T> {
  const retries = options?.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isResearchTimeoutError(error) || attempt >= retries) {
        throw error;
      }
      options?.onRetry?.(attempt + 1);
    }
  }

  throw lastError;
}
