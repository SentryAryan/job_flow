import { afterEach, describe, expect, it, vi } from "vitest";

import { MemorySlidingWindowStore } from "@/lib/rate-limit";
import { enforceResumeExtractRateLimit } from "@/lib/resume-extract-rate-limit";

describe("enforceResumeExtractRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips enforcement in development", async () => {
    vi.stubEnv("APP_ENV", "dev");
    await expect(enforceResumeExtractRateLimit("user-1")).resolves.toEqual({
      enforced: false,
    });
  });

  it("requires REDIS_URL in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("REDIS_URL", "");
    await expect(enforceResumeExtractRateLimit("user-1")).rejects.toThrow(
      /REDIS_URL/,
    );
  });

  it("enforces sliding-window limits in production with an injected store", async () => {
    vi.stubEnv("APP_ENV", "prod");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const store = new MemorySlidingWindowStore();
    // Force the default 1m window (limit 3) by hitting 4 times.
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await enforceResumeExtractRateLimit("user-1", store));
    }

    expect(results[0]).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(results[1]).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(results[2]).toMatchObject({ enforced: true, result: { allowed: true } });
    expect(results[3]).toMatchObject({
      enforced: true,
      result: { allowed: false, blockedBy: "1m" },
    });
  });
});
