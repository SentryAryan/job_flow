import { getRedisClient } from "@/lib/redis";

export type RateLimitWindow = {
  /** Unique suffix for the Redis key (e.g. "1m", "1h", "1d"). */
  name: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max hits allowed inside the window. */
  limit: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the strictest blocking window resets (or current window end). */
  resetAt: number;
  /** Which window rejected the request, if any. */
  blockedBy?: string;
};

export type RateLimitStore = {
  /**
   * Record one hit in a sliding window and return whether it is still under limit.
   * Implementations must be safe across multiple app servers (shared Redis).
   */
  hit(
    key: string,
    window: RateLimitWindow,
  ): Promise<{ count: number; resetAt: number }>;
};

/**
 * Production-grade sliding-window limiter using Redis sorted sets.
 * Works behind a load balancer because every instance shares Redis state
 * (not pub/sub — counters must be durable and queryable).
 */
export class RedisSlidingWindowStore implements RateLimitStore {
  async hit(
    key: string,
    window: RateLimitWindow,
  ): Promise<{ count: number; resetAt: number }> {
    const redis = await getRedisClient();
    const now = Date.now();
    const windowStart = now - window.windowMs;
    const redisKey = `rl:${key}:${window.name}`;
    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;

    const multi = redis.multi();
    multi.zRemRangeByScore(redisKey, 0, windowStart);
    multi.zAdd(redisKey, { score: now, value: member });
    multi.zCard(redisKey);
    multi.pExpire(redisKey, window.windowMs);
    const results = await multi.exec();

    // exec returns [zRem…, zAdd…, zCard…, pExpire…]
    const count = Number(results?.[2] ?? 0);
    return {
      count,
      resetAt: now + window.windowMs,
    };
  }
}

/** In-memory store for unit tests (single process only). */
export class MemorySlidingWindowStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();

  async hit(
    key: string,
    window: RateLimitWindow,
  ): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const redisKey = `rl:${key}:${window.name}`;
    const windowStart = now - window.windowMs;
    const prior = this.hits.get(redisKey) ?? [];
    const next = [...prior.filter((ts) => ts > windowStart), now];
    this.hits.set(redisKey, next);
    return { count: next.length, resetAt: now + window.windowMs };
  }

  clear() {
    this.hits.clear();
  }
}

/**
 * Evaluate multiple windows (e.g. per-minute + per-hour + per-day).
 * A request is denied if ANY window is over limit.
 */
export async function checkRateLimits(
  store: RateLimitStore,
  identityKey: string,
  windows: RateLimitWindow[],
): Promise<RateLimitResult> {
  let strictest: RateLimitResult = {
    allowed: true,
    limit: windows[0]?.limit ?? 0,
    remaining: windows[0]?.limit ?? 0,
    resetAt: Date.now(),
  };

  for (const window of windows) {
    const { count, resetAt } = await store.hit(identityKey, window);
    const remaining = Math.max(0, window.limit - count);
    const allowed = count <= window.limit;

    if (!allowed) {
      return {
        allowed: false,
        limit: window.limit,
        remaining: 0,
        resetAt,
        blockedBy: window.name,
      };
    }

    // Track the window with least remaining headroom for response headers.
    if (
      remaining < strictest.remaining ||
      (remaining === strictest.remaining && resetAt < strictest.resetAt)
    ) {
      strictest = {
        allowed: true,
        limit: window.limit,
        remaining,
        resetAt,
      };
    }
  }

  return strictest;
}

/** Default production windows for expensive resume extraction. */
export const RESUME_EXTRACT_RATE_WINDOWS: RateLimitWindow[] = [
  { name: "1m", windowMs: 60_000, limit: 3 },
  { name: "1h", windowMs: 60 * 60_000, limit: 15 },
  { name: "1d", windowMs: 24 * 60 * 60_000, limit: 40 },
];
