import { isDevelopmentAppEnv, isProductionAppEnv } from "@/lib/app-env";
import { getClientIp, hashIpForRateLimit } from "@/lib/client-ip";
import {
    checkRateLimits,
    getRateLimitUsage,
    getResumeAiIpRateWindows,
    getResumeAiRateWindows,
    RedisSlidingWindowStore,
    resumeAiIdentityKey,
    resumeAiIpIdentityKey,
    type RateLimitResult,
    type RateLimitStore,
    type RateLimitWindowUsage,
} from "@/lib/rate-limit";

const defaultRedisStore = new RedisSlidingWindowStore();

export type ResumeAiRateLimitDecision =
  | { enforced: false }
  | { enforced: true; result: RateLimitResult };

export type ResumeAiUsageSnapshot = {
  available: true;
  combined: true;
  windows: RateLimitWindowUsage[];
};

export type ResumeAiUsageUnavailable = {
  available: false;
  combined: true;
  windows: RateLimitWindowUsage[];
};

export type PeekResumeAiUsageOptions = {
  /** User has BYOK OpenRouter keys — hide shared usage card. */
  hasByokKeys?: boolean;
};

function hasRedisUrl(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

function emptyUsageWindows(): RateLimitWindowUsage[] {
  return getResumeAiRateWindows().map((w) => ({
    name: w.name,
    limit: w.limit,
    used: 0,
    remaining: w.limit,
    resetAt: Date.now() + w.windowMs,
  }));
}

function unavailableSnapshot(): ResumeAiUsageUnavailable {
  return {
    available: false,
    combined: true,
    windows: emptyUsageWindows(),
  };
}

function requireRedisInProduction(): void {
  if (!hasRedisUrl() && isProductionAppEnv()) {
    throw new Error(
      "REDIS_URL is required when APP_ENV is production/prod for resume AI rate limiting",
    );
  }
}

/**
 * Peek whether the shared pool still has headroom — does **not** record a hit.
 * Used by Extract / Generate / Find Jobs / Company Research to admit work.
 * Production without REDIS_URL fails closed (throws).
 */
export async function canUseResumeAiQuota(
  userId: string,
  store: RateLimitStore = defaultRedisStore,
): Promise<
  | { checked: false }
  | { checked: true; allowed: boolean; windows: RateLimitWindowUsage[] }
> {
  requireRedisInProduction();

  if (!hasRedisUrl()) {
    return { checked: false };
  }

  const windows = await getRateLimitUsage(
    store,
    resumeAiIdentityKey(userId),
    getResumeAiRateWindows(),
  );
  const allowed = windows.every((w) => w.remaining > 0);
  return { checked: true, allowed, windows };
}

/**
 * Admit Extract/Generate before work without recording a hit.
 * Returns 429-ready denial only in production when quota is exhausted.
 * Call `enforceResumeAiRateLimit` only after a successful response.
 */
export async function admitResumeAiUserQuota(
  userId: string,
  store: RateLimitStore = defaultRedisStore,
): Promise<
  | { admitted: true }
  | { admitted: false; headers: HeadersInit }
> {
  const peek = await canUseResumeAiQuota(userId, store);
  if (!peek.checked || peek.allowed) {
    return { admitted: true };
  }
  if (!isProductionAppEnv()) {
    return { admitted: true };
  }
  return {
    admitted: false,
    headers: rateLimitHeadersFromUsage(peek.windows),
  };
}

/**
 * Whether every window still has more than `minRemaining` hits left.
 * Use `minRemaining: 1` before Company Research Stagehand extracts so one hit
 * stays reserved for synthesis.
 */
export function hasResumeAiHeadroom(
  windows: RateLimitWindowUsage[],
  minRemaining = 0,
): boolean {
  return windows.every((w) => w.remaining > minRemaining);
}

/** Smallest remaining count across minute/hour/day windows. */
export function minResumeAiRemaining(
  windows: RateLimitWindowUsage[],
): number {
  if (windows.length === 0) return 0;
  return Math.min(...windows.map((w) => w.remaining));
}

/**
 * Record up to `count` hits, but never more than current Redis remaining
 * (prevents writing used past the window limit).
 */
export async function enforceResumeAiRateLimitHitsCapped(
  userId: string,
  count: number,
  store: RateLimitStore = defaultRedisStore,
): Promise<ResumeAiRateLimitDecision & { recorded: number }> {
  const peek = await canUseResumeAiQuota(userId, store);
  if (!peek.checked) {
    return { enforced: false, recorded: 0 };
  }

  const affordable = Math.max(0, minResumeAiRemaining(peek.windows));
  const toRecord = Math.min(Math.max(0, Math.floor(count)), affordable);
  if (toRecord === 0) {
    return { enforced: false, recorded: 0 };
  }

  const last = await enforceResumeAiRateLimitHits(userId, toRecord, store);
  return { ...last, recorded: toRecord };
}

/** Build 429-style headers from a peek when admission is denied (no hit recorded). */
export function rateLimitHeadersFromUsage(
  windows: RateLimitWindowUsage[],
): HeadersInit {
  const blocked = windows.filter((w) => w.remaining <= 0);
  const strictest =
    blocked.length > 0
      ? blocked.reduce((a, b) => (a.resetAt <= b.resetAt ? a : b))
      : windows[0];

  if (!strictest) {
    return rateLimitResponseHeaders({
      allowed: false,
      limit: 0,
      remaining: 0,
      resetAt: Date.now(),
    });
  }

  return rateLimitResponseHeaders({
    allowed: false,
    limit: strictest.limit,
    remaining: 0,
    resetAt: strictest.resetAt,
    blockedBy: strictest.name,
  });
}

/**
 * Shared Extract + Generate + Find Jobs + Company Research pool under `resume-ai:{userId}`.
 * When REDIS_URL is set, always records a hit (usage bar works in any env).
 * Returns 429-ready `enforced: true` only in production/prod.
 * Production without REDIS_URL fails closed (throws).
 *
 * Extract/Generate: call **once after a successful response** (admit with
 * `admitResumeAiUserQuota` first — never record on 429 / failed AI).
 * Find Jobs: call once per **successful AI scoring batch** (not once per click).
 * Company Research: fixed usage flush after the request (see RESEARCH_USAGE_HITS).
 */
export async function enforceResumeAiRateLimit(
  userId: string,
  store: RateLimitStore = defaultRedisStore,
): Promise<ResumeAiRateLimitDecision> {
  const production = isProductionAppEnv();

  if (!hasRedisUrl()) {
    requireRedisInProduction();
    return { enforced: false };
  }

  const result = await checkRateLimits(
    store,
    resumeAiIdentityKey(userId),
    getResumeAiRateWindows(),
  );

  if (!production) {
    return { enforced: false };
  }

  return { enforced: true, result };
}

/**
 * Record `count` hits against the shared Resume AI pool (e.g. Stagehand
 * extract + completion-check = 2 OpenRouter calls, Research fixed 5).
 * Uses one Redis transaction per window via `hitN` (not N sequential hits).
 */
export async function enforceResumeAiRateLimitHits(
  userId: string,
  count: number,
  store: RateLimitStore = defaultRedisStore,
): Promise<ResumeAiRateLimitDecision> {
  const hits = Math.max(0, Math.floor(count));
  if (hits === 0) {
    return { enforced: false };
  }

  if (hits === 1) {
    return enforceResumeAiRateLimit(userId, store);
  }

  const production = isProductionAppEnv();

  if (!hasRedisUrl()) {
    requireRedisInProduction();
    return { enforced: false };
  }

  const result = await checkRateLimits(
    store,
    resumeAiIdentityKey(userId),
    getResumeAiRateWindows(),
    hits,
  );

  if (!production) {
    return { enforced: false };
  }

  return { enforced: true, result };
}

/**
 * Per-IP Resume AI abuse backstop (Extract + Generate + Find Jobs + Company Research).
 * One hit per request. Skips when client IP cannot be determined.
 * Same Redis / production 429 rules as the per-user pool.
 */
export async function enforceResumeAiIpRateLimit(
  request: Request,
  store: RateLimitStore = defaultRedisStore,
): Promise<ResumeAiRateLimitDecision> {
  const ip = getClientIp(request);
  if (!ip) {
    return { enforced: false };
  }

  const production = isProductionAppEnv();

  if (!hasRedisUrl()) {
    requireRedisInProduction();
    return { enforced: false };
  }

  const result = await checkRateLimits(
    store,
    resumeAiIpIdentityKey(hashIpForRateLimit(ip)),
    getResumeAiIpRateWindows(),
  );

  if (!production) {
    return { enforced: false };
  }

  return { enforced: true, result };
}

/**
 * Peek shared pool usage without recording a hit.
 * `available: false` when development, BYOK present, or Redis is not configured.
 */
export async function peekResumeAiUsage(
  userId: string,
  store: RateLimitStore = defaultRedisStore,
  options?: PeekResumeAiUsageOptions,
): Promise<ResumeAiUsageSnapshot | ResumeAiUsageUnavailable> {
  if (isDevelopmentAppEnv() || options?.hasByokKeys) {
    return unavailableSnapshot();
  }

  if (!hasRedisUrl()) {
    return unavailableSnapshot();
  }

  const windows = await getRateLimitUsage(
    store,
    resumeAiIdentityKey(userId),
    getResumeAiRateWindows(),
  );

  return {
    available: true,
    combined: true,
    windows,
  };
}

export function rateLimitResponseHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed
      ? {}
      : {
          "Retry-After": String(
            Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
          ),
        }),
  };
}

/** @deprecated Prefer enforceResumeAiRateLimit — shared pool. */
export const enforceResumeExtractRateLimit = enforceResumeAiRateLimit;
/** @deprecated Prefer enforceResumeAiRateLimit — shared pool. */
export const enforceResumeGenerateRateLimit = enforceResumeAiRateLimit;
