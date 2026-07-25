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

/**
 * Shared Extract + Generate pool under `resume-ai:{userId}`.
 * When REDIS_URL is set, always records a hit (usage bar works in any env).
 * Returns 429-ready `enforced: true` only in production/prod.
 * Production without REDIS_URL fails closed (throws).
 */
export async function enforceResumeAiRateLimit(
  userId: string,
  store: RateLimitStore = defaultRedisStore,
): Promise<ResumeAiRateLimitDecision> {
  const production = isProductionAppEnv();

  if (!hasRedisUrl()) {
    if (production) {
      throw new Error(
        "REDIS_URL is required when APP_ENV is production/prod for resume AI rate limiting",
      );
    }
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
