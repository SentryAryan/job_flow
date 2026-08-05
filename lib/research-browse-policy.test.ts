import { describe, expect, it, vi } from "vitest";

import type { HomepageExtract } from "@/agent/research-schemas";
import {
    canAttemptSubPageExtract,
    isHomepageExtractRichEnough,
    isResearchTimeoutError,
    remainingResearchMs,
    shouldSkipSubPageBecauseHomepageRich,
    withExtractRetry,
} from "@/lib/research-browse-policy";

const thinHome: HomepageExtract = {
  oneLiner: "Short",
  productSummary: "Tiny",
  signals: [],
  pageLinks: [],
};

const richHome: HomepageExtract = {
  oneLiner:
    "Amazon is a global technology and e-commerce leader providing cloud computing.",
  productSummary:
    "Amazon offers AWS cloud computing, retail shopping, Prime memberships, devices, and digital entertainment for consumers and enterprises worldwide.",
  signals: [
    "AWS revenue growth 36.7% YoY",
    "OpenAI models on Bedrock",
    "11,000 jobs via carbon project",
  ],
  pageLinks: [{ url: "https://www.aboutamazon.com/about-us", kind: "about" }],
};

describe("isHomepageExtractRichEnough", () => {
  it("rejects thin extracts", () => {
    expect(isHomepageExtractRichEnough(thinHome)).toBe(false);
  });

  it("accepts solid homepage extracts", () => {
    expect(isHomepageExtractRichEnough(richHome)).toBe(true);
  });
});

describe("canAttemptSubPageExtract", () => {
  it("requires goto + extract + synthesis reserve", () => {
    expect(
      canAttemptSubPageExtract({
        remainingMs: 60_000 + 180_000 + 90_000,
        gotoMs: 60_000,
        extractMs: 180_000,
      }),
    ).toBe(true);
    expect(
      canAttemptSubPageExtract({
        remainingMs: 60_000 + 180_000 + 90_000 - 1,
        gotoMs: 60_000,
        extractMs: 180_000,
      }),
    ).toBe(false);
  });

  it("doubles extract budget when retry is required", () => {
    expect(
      canAttemptSubPageExtract({
        remainingMs: 60_000 + 360_000 + 90_000,
        gotoMs: 60_000,
        extractMs: 180_000,
        includeRetryBudget: true,
      }),
    ).toBe(true);
    expect(
      canAttemptSubPageExtract({
        remainingMs: 60_000 + 180_000 + 90_000,
        gotoMs: 60_000,
        extractMs: 180_000,
        includeRetryBudget: true,
      }),
    ).toBe(false);
  });
});

describe("shouldSkipSubPageBecauseHomepageRich", () => {
  it("does not skip thin homepage even with low budget", () => {
    expect(
      shouldSkipSubPageBecauseHomepageRich({
        extract: thinHome,
        remainingMs: 10_000,
        gotoMs: 60_000,
        extractMs: 180_000,
      }),
    ).toBe(false);
  });

  it("skips rich homepage when a single extract attempt cannot fit", () => {
    expect(
      shouldSkipSubPageBecauseHomepageRich({
        extract: richHome,
        remainingMs: 60_000 + 180_000 + 90_000 - 1,
        gotoMs: 60_000,
        extractMs: 180_000,
      }),
    ).toBe(true);
  });

  it("allows rich homepage when one extract attempt fits (no 2× retry required)", () => {
    expect(
      shouldSkipSubPageBecauseHomepageRich({
        extract: richHome,
        remainingMs: 60_000 + 180_000 + 90_000,
        gotoMs: 60_000,
        extractMs: 180_000,
      }),
    ).toBe(false);
    // Production footgun: 300s extract + rich homepage with ~12 min left
    expect(
      shouldSkipSubPageBecauseHomepageRich({
        extract: richHome,
        remainingMs: 722_397,
        gotoMs: 60_000,
        extractMs: 300_000,
      }),
    ).toBe(false);
  });
});

describe("remainingResearchMs", () => {
  it("clamps at zero", () => {
    expect(remainingResearchMs(1000, 2000)).toBe(0);
    expect(remainingResearchMs(5000, 2000)).toBe(3000);
  });
});

describe("withExtractRetry", () => {
  it("returns on first success", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    await expect(withExtractRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries once on timeout then succeeds", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("Company sub-page extract timed out"))
      .mockResolvedValueOnce({ keyPoints: ["a"] });
    const onRetry = vi.fn();

    await expect(withExtractRetry(run, { onRetry })).resolves.toEqual({
      keyPoints: ["a"],
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it("does not retry non-timeout errors", async () => {
    const run = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withExtractRetry(run)).rejects.toThrow("boom");
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("isResearchTimeoutError", () => {
  it("detects timeout messages", () => {
    expect(
      isResearchTimeoutError(new Error("Company sub-page extract timed out")),
    ).toBe(true);
    expect(isResearchTimeoutError(new Error("network"))).toBe(false);
  });
});
