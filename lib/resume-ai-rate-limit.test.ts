import { afterEach, describe, expect, it, vi } from "vitest";

import { MemorySlidingWindowStore } from "@/lib/rate-limit";
import {
    enforceResumeAiRateLimit,
    peekResumeAiUsage,
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
