/**
 * Company Research budgets (env-overridable).
 *
 * Platform clamp mode (`RESEARCH_TIMEOUT_CLAMP` / `NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP`):
 * - unset | `clamp` | `hobby` → cap budgets under Vercel Hobby Serverless (300s)
 * - `no_clamp` | `off` | `none` → use configured/realistic long-running defaults (self-host / Pro)
 *
 * Keep EXTRACT small enough that goto + 2×EXTRACT + 90s synthesis fits in OVERALL.
 */

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Vercel Hobby Serverless Function ceiling (seconds). */
export const RESEARCH_HOBBY_MAX_DURATION_SEC = 300;

/** Seconds reserved under the platform kill so the handler can return a response. */
const PLATFORM_HEADROOM_SEC = 15;

/** @deprecated Prefer RESEARCH_HOBBY_MAX_DURATION_SEC; kept for older imports/tests. */
export const RESEARCH_ROUTE_MAX_DURATION_SEC = RESEARCH_HOBBY_MAX_DURATION_SEC;

export type ResearchTimeoutClampMode = "clamp" | "no_clamp";

/**
 * Resolve clamp mode. Prefer NEXT_PUBLIC_ so client AbortSignal matches server.
 * Unknown values fall back to `clamp` (safe for Vercel Hobby builds).
 */
export function researchTimeoutClampMode(): ResearchTimeoutClampMode {
  const raw = (
    process.env.NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP?.trim() ||
    process.env.RESEARCH_TIMEOUT_CLAMP?.trim() ||
    ""
  ).toLowerCase();

  if (
    raw === "no_clamp" ||
    raw === "noclamp" ||
    raw === "off" ||
    raw === "none" ||
    raw === "false" ||
    raw === "0"
  ) {
    return "no_clamp";
  }

  // unset, clamp, hobby, true, 1, or anything else → Hobby-safe
  return "clamp";
}

export function isResearchTimeoutClampEnabled(): boolean {
  return researchTimeoutClampMode() === "clamp";
}

/**
 * Route `maxDuration` (seconds) for `POST /api/agent/research`.
 * Clamp mode → 300 (Hobby). no_clamp → `RESEARCH_ROUTE_MAX_DURATION_SEC` or 800.
 * Do not set no_clamp on Vercel Hobby — the build rejects maxDuration > 300.
 */
export function researchRouteMaxDurationSec(): number {
  if (isResearchTimeoutClampEnabled()) {
    return RESEARCH_HOBBY_MAX_DURATION_SEC;
  }
  return parsePositiveInt(process.env.RESEARCH_ROUTE_MAX_DURATION_SEC, 800);
}

/** Soft overall budget ceiling under the Serverless Function limit (ms). */
export function researchPlatformBudgetMs(): number {
  return (researchRouteMaxDurationSec() - PLATFORM_HEADROOM_SEC) * 1000;
}

function maybeClampMs(valueMs: number, capMs: number): number {
  if (!isResearchTimeoutClampEnabled()) return valueMs;
  return Math.min(valueMs, capMs);
}

function maybeClampSec(valueSec: number, capSec: number): number {
  if (!isResearchTimeoutClampEnabled()) return valueSec;
  return Math.min(valueSec, capSec);
}

/** Browserbase session length in seconds. */
export function browserbaseSessionTimeoutSec(): number {
  const fallback = isResearchTimeoutClampEnabled()
    ? RESEARCH_HOBBY_MAX_DURATION_SEC - PLATFORM_HEADROOM_SEC
    : 780;
  const configured = parsePositiveInt(
    process.env.BROWSERBASE_SESSION_TIMEOUT_SEC,
    fallback,
  );
  return maybeClampSec(configured, researchRouteMaxDurationSec());
}

/** Whole researchCompany budget in ms. */
export function researchOverallTimeoutMs(): number {
  const fallback = isResearchTimeoutClampEnabled() ? 270_000 : 720_000;
  const configured = parsePositiveInt(
    process.env.RESEARCH_OVERALL_TIMEOUT_MS,
    fallback,
  );
  return maybeClampMs(configured, researchPlatformBudgetMs());
}

/** Each page.goto budget in ms. */
export function researchGotoTimeoutMs(): number {
  const fallback = isResearchTimeoutClampEnabled() ? 45_000 : 60_000;
  return parsePositiveInt(process.env.RESEARCH_GOTO_TIMEOUT_MS, fallback);
}

/**
 * Each stagehand.extract budget in ms.
 * Keep small enough that goto + 2×EXTRACT + 90s synthesis fits in OVERALL.
 */
export function researchExtractTimeoutMs(): number {
  const fallback = isResearchTimeoutClampEnabled() ? 60_000 : 180_000;
  return parsePositiveInt(process.env.RESEARCH_EXTRACT_TIMEOUT_MS, fallback);
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

/**
 * Client AbortSignal for researchCompanyForJob.
 * Slightly above overall; clamped to route maxDuration when clamp mode is on.
 */
export function researchClientAbortTimeoutMs(): number {
  const fallback = isResearchTimeoutClampEnabled() ? 285_000 : 750_000;
  const configured = parsePositiveInt(
    process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS,
    fallback,
  );
  return maybeClampMs(configured, researchRouteMaxDurationSec() * 1000);
}
