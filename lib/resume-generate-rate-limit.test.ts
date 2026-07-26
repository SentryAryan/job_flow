/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-env", () => ({
  isProductionAppEnv: vi.fn(() => false),
}));

import { isProductionAppEnv } from "@/lib/app-env";
import { MemorySlidingWindowStore } from "@/lib/rate-limit";
import { enforceResumeGenerateRateLimit } from "@/lib/resume-generate-rate-limit";

describe("enforceResumeGenerateRateLimit (compat → shared pool)", () => {
  beforeEach(() => {
    vi.mocked(isProductionAppEnv).mockReturnValue(false);
    delete process.env.REDIS_URL;
  });

  it("skips without Redis in non-production", async () => {
    const decision = await enforceResumeGenerateRateLimit("user-1");
    expect(decision).toEqual({ enforced: false });
  });

  it("enforces with memory store in production", async () => {
    vi.mocked(isProductionAppEnv).mockReturnValue(true);
    process.env.REDIS_URL = "redis://localhost:6379";
    const store = new MemorySlidingWindowStore();

    const first = await enforceResumeGenerateRateLimit("user-1", store);
    expect(first.enforced).toBe(true);
    if (first.enforced) {
      expect(first.result.allowed).toBe(true);
    }
  });

  it("throws when production lacks REDIS_URL", async () => {
    vi.mocked(isProductionAppEnv).mockReturnValue(true);
    delete process.env.REDIS_URL;
    await expect(enforceResumeGenerateRateLimit("user-1")).rejects.toThrow(
      /REDIS_URL/,
    );
  });
});
