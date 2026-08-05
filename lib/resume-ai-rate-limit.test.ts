import { afterEach, describe, expect, it, vi } from "vitest";

import { MemorySlidingWindowStore } from "@/lib/rate-limit";
import {
    canUseResumeAiQuota,
    enforceResumeAiIpRateLimit,
    enforceResumeAiRateLimit,
    enforceResumeAiRateLimitHitsCapped,
    minResumeAiRemaining,
    peekResumeAiUsage,
    rateLimitHeadersFromUsage,
} from "@/lib/resume-ai-rate-limit";

describe("enforceResumeAiRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips without Redis in development", async () => {
    vi.stubEnv("APP_ENV", "dev");
    vi.stubEnv("REDIS_URL", "");
    await expect(enforceResumeAiRateLimit("user-1")).resolves.toEqual({
      enforced: false,
    });
  });

  it("requires REDIS_URL in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "");
    await expect(enforceResumeAiRateLimit("user-1")).rejects.toThrow(
      /REDIS_URL/,
    );
  });

  it("records hits in development when Redis URL is set but does not enforce", async () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const store = new MemorySlidingWindowStore();

    for (let i = 0; i < 5; i++) {
      await expect(
        enforceResumeAiRateLimit("user-1", store),
      ).resolves.toEqual({ enforced: false });
    }

    // Usage card is hidden in development; peek under production to verify hits.
    vi.stubEnv("APP_ENV", "production");
    const usage = await peekResumeAiUsage("user-1", store);
    expect(usage.available).toBe(true);
    expect(usage.windows.find((w) => w.name === "1m")?.used).toBe(5);
  });

  it("enforces shared sliding-window limits in production", async () => {
    vi.stubEnv("APP_ENV", "prod");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const store = new MemorySlidingWindowStore();
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await enforceResumeAiRateLimit("user-1", store));
    }

    expect(results[0]).toMatchObject({
      enforced: true,
      result: { allowed: true },
    });
    expect(results[1]).toMatchObject({
      enforced: true,
      result: { allowed: true },
    });
    expect(results[2]).toMatchObject({
      enforced: true,
      result: { allowed: true },
    });
    expect(results[3]).toMatchObject({
      enforced: true,
      result: { allowed: false, blockedBy: "1m" },
    });
  });

  it("shares one pool across sequential enforce calls (extract + generate)", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_MINUTE", "2");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_HOUR", "15");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_DAY", "40");

    const store = new MemorySlidingWindowStore();
    const a = await enforceResumeAiRateLimit("user-x", store);
    const b = await enforceResumeAiRateLimit("user-x", store);
    const c = await enforceResumeAiRateLimit("user-x", store);

    expect(a).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(b).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(c).toMatchObject({
      enforced: true,
      result: { allowed: false, blockedBy: "1m" },
    });
  });
});

describe("canUseResumeAiQuota", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns checked false without Redis in development", async () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("REDIS_URL", "");
    await expect(canUseResumeAiQuota("user-1")).resolves.toEqual({
      checked: false,
    });
  });

  it("requires REDIS_URL in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "");
    await expect(canUseResumeAiQuota("user-1")).rejects.toThrow(/REDIS_URL/);
  });

  it("reports allowed false when a window is exhausted", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_MINUTE", "1");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_HOUR", "15");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_DAY", "40");

    const store = new MemorySlidingWindowStore();
    await enforceResumeAiRateLimit("user-1", store);

    const quota = await canUseResumeAiQuota("user-1", store);
    expect(quota).toMatchObject({ checked: true, allowed: false });
  });

  it("does not record a hit when peeking", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const store = new MemorySlidingWindowStore();

    await canUseResumeAiQuota("user-1", store);
    await canUseResumeAiQuota("user-1", store);

    const usage = await peekResumeAiUsage("user-1", store);
    expect(usage.available).toBe(true);
    expect(usage.windows.find((w) => w.name === "1m")?.used).toBe(0);
  });
});

describe("rateLimitHeadersFromUsage", () => {
  it("exposes Retry-After style headers for an exhausted window", () => {
    const headers = rateLimitHeadersFromUsage([
      {
        name: "1m",
        limit: 3,
        used: 3,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      },
    ]);
    expect(headers).toMatchObject({
      "X-RateLimit-Limit": "3",
      "X-RateLimit-Remaining": "0",
    });
    expect(headers).toHaveProperty("Retry-After");
  });
});

describe("peekResumeAiUsage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns available false without Redis", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "");
    const snap = await peekResumeAiUsage("user-1");
    expect(snap.available).toBe(false);
    expect(snap.combined).toBe(true);
    expect(snap.windows).toHaveLength(3);
  });

  it("returns available false in development even with Redis", async () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const store = new MemorySlidingWindowStore();
    const snap = await peekResumeAiUsage("user-1", store);
    expect(snap.available).toBe(false);
  });

  it("returns available false when user has BYOK keys", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const store = new MemorySlidingWindowStore();
    const snap = await peekResumeAiUsage("user-1", store, {
      hasByokKeys: true,
    });
    expect(snap.available).toBe(false);
  });
});

describe("enforceResumeAiIpRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function requestWithIp(ip: string) {
    return new Request("http://localhost/api/resume/extract", {
      headers: { "x-forwarded-for": ip },
    });
  }

  it("skips when client IP cannot be determined", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const store = new MemorySlidingWindowStore();
    await expect(
      enforceResumeAiIpRateLimit(new Request("http://localhost/api"), store),
    ).resolves.toEqual({ enforced: false });
  });

  it("skips without Redis in development", async () => {
    vi.stubEnv("APP_ENV", "dev");
    vi.stubEnv("REDIS_URL", "");
    await expect(
      enforceResumeAiIpRateLimit(requestWithIp("203.0.113.1")),
    ).resolves.toEqual({ enforced: false });
  });

  it("requires REDIS_URL in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "");
    await expect(
      enforceResumeAiIpRateLimit(requestWithIp("203.0.113.1")),
    ).rejects.toThrow(/REDIS_URL/);
  });

  it("records hits in development but does not enforce", async () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_MINUTE", "2");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_HOUR", "45");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_DAY", "120");
    const store = new MemorySlidingWindowStore();
    const req = requestWithIp("203.0.113.9");

    for (let i = 0; i < 3; i++) {
      await expect(enforceResumeAiIpRateLimit(req, store)).resolves.toEqual({
        enforced: false,
      });
    }
  });

  it("enforces IP sliding-window limits in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_MINUTE", "2");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_HOUR", "45");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_DAY", "120");
    const store = new MemorySlidingWindowStore();
    const req = requestWithIp("203.0.113.42");

    const a = await enforceResumeAiIpRateLimit(req, store);
    const b = await enforceResumeAiIpRateLimit(req, store);
    const c = await enforceResumeAiIpRateLimit(req, store);

    expect(a).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(b).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(c).toMatchObject({
      enforced: true,
      result: { allowed: false, blockedBy: "1m" },
    });
  });

  it("isolates IP pools from each other", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_MINUTE", "1");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_HOUR", "45");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_DAY", "120");
    const store = new MemorySlidingWindowStore();

    expect(
      await enforceResumeAiIpRateLimit(requestWithIp("203.0.113.1"), store),
    ).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(
      await enforceResumeAiIpRateLimit(requestWithIp("203.0.113.2"), store),
    ).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(
      await enforceResumeAiIpRateLimit(requestWithIp("203.0.113.1"), store),
    ).toMatchObject({
      enforced: true,
      result: { allowed: false, blockedBy: "1m" },
    });
  });
});

describe("enforceResumeAiRateLimitHitsCapped", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not record more hits than remaining across windows", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_MINUTE", "3");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_HOUR", "15");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_DAY", "40");
    const store = new MemorySlidingWindowStore();

    await enforceResumeAiRateLimit("user-cap", store);
    await enforceResumeAiRateLimit("user-cap", store);

    const capped = await enforceResumeAiRateLimitHitsCapped(
      "user-cap",
      5,
      store,
    );
    expect(capped.recorded).toBe(1);

    const usage = await peekResumeAiUsage("user-cap", store);
    expect(usage.available).toBe(true);
    expect(usage.windows.find((w) => w.name === "1m")?.used).toBe(3);
    expect(minResumeAiRemaining(usage.windows)).toBe(0);
  });
});
