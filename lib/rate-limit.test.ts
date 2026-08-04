import { afterEach, describe, expect, it, vi } from "vitest";

import {
    MemorySlidingWindowStore,
    checkRateLimits,
    getRateLimitUsage,
    getResumeAiIpRateWindows,
    getResumeAiRateWindows,
} from "@/lib/rate-limit";

describe("checkRateLimits (memory sliding window)", () => {
  it("allows requests under the limit and blocks when exceeded", async () => {
    const store = new MemorySlidingWindowStore();
    const windows = [{ name: "1m", windowMs: 60_000, limit: 2 }];

    const first = await checkRateLimits(store, "user-a", windows);
    const second = await checkRateLimits(store, "user-a", windows);
    const third = await checkRateLimits(store, "user-a", windows);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.blockedBy).toBe("1m");
    expect(third.remaining).toBe(0);
  });

  it("isolates keys per identity", async () => {
    const store = new MemorySlidingWindowStore();
    const windows = [{ name: "1m", windowMs: 60_000, limit: 1 }];

    expect((await checkRateLimits(store, "a", windows)).allowed).toBe(true);
    expect((await checkRateLimits(store, "b", windows)).allowed).toBe(true);
    expect((await checkRateLimits(store, "a", windows)).allowed).toBe(false);
  });
});

describe("peek / getRateLimitUsage", () => {
  it("does not increment counts on peek", async () => {
    const store = new MemorySlidingWindowStore();
    const windows = [{ name: "1m", windowMs: 60_000, limit: 5 }];

    await checkRateLimits(store, "user-a", windows);
    const before = await getRateLimitUsage(store, "user-a", windows);
    expect(before[0]?.used).toBe(1);

    const again = await getRateLimitUsage(store, "user-a", windows);
    expect(again[0]?.used).toBe(1);
    expect(again[0]?.remaining).toBe(4);
  });

  it("reflects hits after checkRateLimits", async () => {
    const store = new MemorySlidingWindowStore();
    const windows = [
      { name: "1m", windowMs: 60_000, limit: 3 },
      { name: "1h", windowMs: 3_600_000, limit: 15 },
    ];

    await checkRateLimits(store, "shared", windows);
    await checkRateLimits(store, "shared", windows);

    const usage = await getRateLimitUsage(store, "shared", windows);
    expect(usage).toEqual([
      expect.objectContaining({ name: "1m", used: 2, limit: 3, remaining: 1 }),
      expect.objectContaining({ name: "1h", used: 2, limit: 15, remaining: 13 }),
    ]);
  });
});

describe("getResumeAiRateWindows", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults when env unset", () => {
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_MINUTE", "");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_HOUR", "");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_DAY", "");
    expect(getResumeAiRateWindows()).toEqual([
      { name: "1m", windowMs: 60_000, limit: 3 },
      { name: "1h", windowMs: 60 * 60_000, limit: 15 },
      { name: "1d", windowMs: 24 * 60 * 60_000, limit: 40 },
    ]);
  });

  it("parses positive integer env overrides", () => {
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_MINUTE", "5");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_HOUR", "20");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_DAY", "100");
    expect(getResumeAiRateWindows().map((w) => w.limit)).toEqual([5, 20, 100]);
  });

  it("falls back to defaults for invalid values", () => {
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_MINUTE", "0");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_HOUR", "nope");
    vi.stubEnv("RESUME_AI_RATE_LIMIT_PER_DAY", "-3");
    expect(getResumeAiRateWindows().map((w) => w.limit)).toEqual([3, 15, 40]);
  });
});

describe("getResumeAiIpRateWindows", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns IP defaults when env unset", () => {
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_MINUTE", "");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_HOUR", "");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_DAY", "");
    expect(getResumeAiIpRateWindows()).toEqual([
      { name: "1m", windowMs: 60_000, limit: 10 },
      { name: "1h", windowMs: 60 * 60_000, limit: 45 },
      { name: "1d", windowMs: 24 * 60 * 60_000, limit: 120 },
    ]);
  });

  it("parses positive integer IP env overrides", () => {
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_MINUTE", "20");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_HOUR", "90");
    vi.stubEnv("RESUME_AI_IP_RATE_LIMIT_PER_DAY", "200");
    expect(getResumeAiIpRateWindows().map((w) => w.limit)).toEqual([
      20, 90, 200,
    ]);
  });
});
