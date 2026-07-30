import { isDevelopmentAppEnv, isProductionAppEnv } from "@/lib/app-env";
import {
    checkRateLimits,
    getRateLimitUsage,
    getResumeAiRateWindows,
    RedisSlidingWindowStore,
    resumeAiIdentityKey,
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
 * Used by Find Jobs to admit a search and to decide whether a scoring batch may use AI.
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
 * Shared Extract + Generate + Find Jobs pool under `resume-ai:{userId}`.
 * When REDIS_URL is set, always records a hit (usage bar works in any env).
 * Returns 429-ready `enforced: true` only in production/prod.
 * Production without REDIS_URL fails closed (throws).
 *
 * Extract/Generate: call once per request (before AI).
 * Find Jobs: call once per **successful AI scoring batch** (not once per click).
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
