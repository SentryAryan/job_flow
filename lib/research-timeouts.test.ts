import { afterEach, describe, expect, it } from "vitest";

import {
    browserbaseSessionTimeoutSec,
    researchClientAbortTimeoutMs,
    researchExtractTimeoutMs,
    researchGotoTimeoutMs,
    researchOverallTimeoutMs,
} from "@/lib/research-timeouts";

describe("research-timeouts", () => {
  afterEach(() => {
    delete process.env.BROWSERBASE_SESSION_TIMEOUT_SEC;
    delete process.env.RESEARCH_OVERALL_TIMEOUT_MS;
    delete process.env.RESEARCH_GOTO_TIMEOUT_MS;
    delete process.env.RESEARCH_EXTRACT_TIMEOUT_MS;
    delete process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS;
  });

  it("uses long defaults", () => {
    expect(browserbaseSessionTimeoutSec()).toBe(600);
    expect(researchOverallTimeoutMs()).toBe(720_000);
    expect(researchGotoTimeoutMs()).toBe(60_000);
    expect(researchExtractTimeoutMs()).toBe(180_000);
    expect(researchClientAbortTimeoutMs()).toBe(750_000);
  });

  it("reads env overrides", () => {
    process.env.BROWSERBASE_SESSION_TIMEOUT_SEC = "900";
    process.env.RESEARCH_OVERALL_TIMEOUT_MS = "600000";
    process.env.RESEARCH_GOTO_TIMEOUT_MS = "45000";
    process.env.RESEARCH_EXTRACT_TIMEOUT_MS = "120000";
    process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS = "800000";

    expect(browserbaseSessionTimeoutSec()).toBe(900);
    expect(researchOverallTimeoutMs()).toBe(600_000);
    expect(researchGotoTimeoutMs()).toBe(45_000);
    expect(researchExtractTimeoutMs()).toBe(120_000);
    expect(researchClientAbortTimeoutMs()).toBe(800_000);
  });

  it("ignores invalid env values", () => {
    process.env.BROWSERBASE_SESSION_TIMEOUT_SEC = "nope";
    expect(browserbaseSessionTimeoutSec()).toBe(600);
  });
});
