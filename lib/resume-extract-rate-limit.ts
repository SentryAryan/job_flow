import { isProductionAppEnv } from "@/lib/app-env";
import {
    checkRateLimits,
    RedisSlidingWindowStore,
    RESUME_EXTRACT_RATE_WINDOWS,
    type RateLimitResult,
    type RateLimitStore,
} from "@/lib/rate-limit";

const defaultRedisStore = new RedisSlidingWindowStore();

export type ResumeExtractRateLimitDecision =
  | { enforced: false }
  | { enforced: true; result: RateLimitResult };

/**
 * Apply resume-extract rate limits only when APP_ENV/NODE_ENV is production/prod.
 * Development/dev/test skip limits entirely (no Redis required).
 * Production requires REDIS_URL — shared Redis sliding-window state coordinates
 * multiple app servers behind a load balancer (durable counters, not pub/sub).
 */
export async function enforceResumeExtractRateLimit(
  userId: string,
  store: RateLimitStore = defaultRedisStore,
): Promise<ResumeExtractRateLimitDecision> {
  if (!isProductionAppEnv()) {
    return { enforced: false };
  }

  if (!process.env.REDIS_URL?.trim()) {
    throw new Error(
      "REDIS_URL is required when APP_ENV is production/prod for resume extract rate limiting",
    );
  }

  const result = await checkRateLimits(
    store,
    `resume-extract:${userId}`,
    RESUME_EXTRACT_RATE_WINDOWS,
  );

  return { enforced: true, result };
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
