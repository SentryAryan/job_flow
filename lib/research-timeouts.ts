/**
 * Long-by-design timeouts for Company Research (env-overridable).
 * Keep generous so slow OpenRouter free + multi-page browse are not cut mid-flight.
 */

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Browserbase session length in seconds (default 10 min). */
export function browserbaseSessionTimeoutSec(): number {
  return parsePositiveInt(process.env.BROWSERBASE_SESSION_TIMEOUT_SEC, 600);
}

/** Whole researchCompany budget in ms (default 12 min). */
export function researchOverallTimeoutMs(): number {
  return parsePositiveInt(process.env.RESEARCH_OVERALL_TIMEOUT_MS, 720_000);
}

/** Each page.goto budget in ms (default 60s). */
export function researchGotoTimeoutMs(): number {
  return parsePositiveInt(process.env.RESEARCH_GOTO_TIMEOUT_MS, 60_000);
}

/** Each stagehand.extract budget in ms (default 3 min). */
export function researchExtractTimeoutMs(): number {
  return parsePositiveInt(process.env.RESEARCH_EXTRACT_TIMEOUT_MS, 180_000);
}

/** Homepage redirect fetch budget in ms (default 20s). */
export const RESEARCH_HOMEPAGE_FETCH_TIMEOUT_MS = 20_000;

/**
 * Hard ceiling on OpenRouter chat completions per Research Company request
 * (homepage extract ~2 + one sub-page ~2 + synthesis ~1).
 */
export const RESEARCH_MAX_OPENROUTER_CALLS = 5;

/**
 * Fixed Redis usage charge per admitted Research Company request.
 * Matches the OpenRouter ceiling so usage/rate limits stay predictable.
 */
export const RESEARCH_USAGE_HITS = 5;

/** Client AbortSignal for researchCompanyForJob (default 12.5 min > server). */
export function researchClientAbortTimeoutMs(): number {
  return parsePositiveInt(process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS, 750_000);
}
