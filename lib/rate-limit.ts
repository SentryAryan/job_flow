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

export type RateLimitWindowUsage = {
  name: string;
  limit: number;
  used: number;
  remaining: number;
  resetAt: number;
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
  /**
   * Record `n` hits in one sliding-window transaction (atomic for Redis).
   */
  hitN(
    key: string,
    window: RateLimitWindow,
    n: number,
  ): Promise<{ count: number; resetAt: number }>;
  /**
   * Read current hit count without recording a new hit.
   */
  peek(
    key: string,
    window: RateLimitWindow,
  ): Promise<{ count: number; resetAt: number }>;
};

function redisKeyFor(key: string, window: RateLimitWindow): string {
  return `rl:${key}:${window.name}`;
}

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
    return this.hitN(key, window, 1);
  }

  async hitN(
    key: string,
    window: RateLimitWindow,
    n: number,
  ): Promise<{ count: number; resetAt: number }> {
    const hits = Math.max(0, Math.floor(n));
    if (hits === 0) {
      return this.peek(key, window);
    }

    const redis = await getRedisClient();
    const now = Date.now();
    const windowStart = now - window.windowMs;
    const redisKey = redisKeyFor(key, window);

    const multi = redis.multi();
    multi.zRemRangeByScore(redisKey, 0, windowStart);
    for (let i = 0; i < hits; i += 1) {
      const member = `${now}:${i}:${Math.random().toString(36).slice(2, 10)}`;
      multi.zAdd(redisKey, { score: now, value: member });
    }
    multi.zCard(redisKey);
    multi.pExpire(redisKey, window.windowMs);
    const results = await multi.exec();

    // exec returns [zRem…, zAdd×n…, zCard…, pExpire…]
    const count = Number(results?.[1 + hits] ?? 0);
    return {
      count,
      resetAt: now + window.windowMs,
    };
  }

  async peek(
    key: string,
    window: RateLimitWindow,
  ): Promise<{ count: number; resetAt: number }> {
    const redis = await getRedisClient();
    const now = Date.now();
    const windowStart = now - window.windowMs;
    const redisKey = redisKeyFor(key, window);

    const multi = redis.multi();
    multi.zRemRangeByScore(redisKey, 0, windowStart);
    multi.zCard(redisKey);
    multi.pExpire(redisKey, window.windowMs);
    const results = await multi.exec();

    const count = Number(results?.[1] ?? 0);
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
    return this.hitN(key, window, 1);
  }

  async hitN(
    key: string,
    window: RateLimitWindow,
    n: number,
  ): Promise<{ count: number; resetAt: number }> {
    const hits = Math.max(0, Math.floor(n));
    const now = Date.now();
    const redisKey = redisKeyFor(key, window);
    const windowStart = now - window.windowMs;
    const prior = this.hits.get(redisKey) ?? [];
    const kept = prior.filter((ts) => ts > windowStart);
    const next = [...kept, ...Array.from({ length: hits }, () => now)];
    this.hits.set(redisKey, next);
    return { count: next.length, resetAt: now + window.windowMs };
  }

  async peek(
    key: string,
    window: RateLimitWindow,
  ): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const redisKey = redisKeyFor(key, window);
    const windowStart = now - window.windowMs;
    const prior = this.hits.get(redisKey) ?? [];
    const next = prior.filter((ts) => ts > windowStart);
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
  hits = 1,
): Promise<RateLimitResult> {
  const n = Math.max(1, Math.floor(hits));
  let strictest: RateLimitResult = {
    allowed: true,
    limit: windows[0]?.limit ?? 0,
    remaining: windows[0]?.limit ?? 0,
    resetAt: Date.now(),
  };

  for (const window of windows) {
    const { count, resetAt } = await store.hitN(identityKey, window, n);
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

/** Read current usage for all windows without recording hits. */
export async function getRateLimitUsage(
  store: RateLimitStore,
  identityKey: string,
  windows: RateLimitWindow[],
): Promise<RateLimitWindowUsage[]> {
  const now = Date.now();
  const usage: RateLimitWindowUsage[] = [];

  for (const window of windows) {
    const { count, resetAt } = await store.peek(identityKey, window);
    usage.push({
      name: window.name,
      limit: window.limit,
      used: count,
      remaining: Math.max(0, window.limit - count),
      resetAt: resetAt || now + window.windowMs,
    });
  }

  return usage;
}

const DEFAULT_LIMITS = {
  minute: 3,
  hour: 15,
  day: 40,
} as const;

const DEFAULT_IP_LIMITS = {
  minute: 10,
  hour: 45,
  day: 120,
} as const;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/** Env-configurable Resume AI windows (extract + generate + find jobs shared pool). */
export function getResumeAiRateWindows(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitWindow[] {
  return [
    {
      name: "1m",
      windowMs: 60_000,
      limit: parsePositiveInt(
        env.RESUME_AI_RATE_LIMIT_PER_MINUTE,
        DEFAULT_LIMITS.minute,
      ),
    },
    {
      name: "1h",
      windowMs: 60 * 60_000,
      limit: parsePositiveInt(
        env.RESUME_AI_RATE_LIMIT_PER_HOUR,
        DEFAULT_LIMITS.hour,
      ),
    },
    {
      name: "1d",
      windowMs: 24 * 60 * 60_000,
      limit: parsePositiveInt(
        env.RESUME_AI_RATE_LIMIT_PER_DAY,
        DEFAULT_LIMITS.day,
      ),
    },
  ];
}

/**
 * Looser per-IP windows (~3× user) for multi-account abuse backstop.
 * Shared across Extract + Generate + Find Jobs (1 hit per request).
 */
export function getResumeAiIpRateWindows(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitWindow[] {
  return [
    {
      name: "1m",
      windowMs: 60_000,
      limit: parsePositiveInt(
        env.RESUME_AI_IP_RATE_LIMIT_PER_MINUTE,
        DEFAULT_IP_LIMITS.minute,
      ),
    },
    {
      name: "1h",
      windowMs: 60 * 60_000,
      limit: parsePositiveInt(
        env.RESUME_AI_IP_RATE_LIMIT_PER_HOUR,
        DEFAULT_IP_LIMITS.hour,
      ),
    },
    {
      name: "1d",
      windowMs: 24 * 60 * 60_000,
      limit: parsePositiveInt(
        env.RESUME_AI_IP_RATE_LIMIT_PER_DAY,
        DEFAULT_IP_LIMITS.day,
      ),
    },
  ];
}

/** @deprecated Use getResumeAiRateWindows() — kept for transitional imports. */
export const RESUME_EXTRACT_RATE_WINDOWS: RateLimitWindow[] =
  getResumeAiRateWindows();

export const RESUME_AI_IDENTITY_PREFIX = "resume-ai";
export const RESUME_AI_IP_IDENTITY_PREFIX = "resume-ai-ip";

export function resumeAiIdentityKey(userId: string): string {
  return `${RESUME_AI_IDENTITY_PREFIX}:${userId}`;
}

/** `ipHash` from hashIpForRateLimit — never pass a raw IP. */
export function resumeAiIpIdentityKey(ipHash: string): string {
  return `${RESUME_AI_IP_IDENTITY_PREFIX}:${ipHash}`;
}
