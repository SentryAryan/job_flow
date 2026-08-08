import { afterEach, describe, expect, it } from "vitest";

import {
    browserbaseSessionTimeoutSec,
    isResearchTimeoutClampEnabled,
    RESEARCH_HOBBY_MAX_DURATION_SEC,
    researchClientAbortTimeoutMs,
    researchExtractTimeoutMs,
    researchGotoTimeoutMs,
    researchOverallTimeoutMs,
    researchPlatformBudgetMs,
    researchRouteMaxDurationSec,
    researchTimeoutClampMode,
} from "@/lib/research-timeouts";

describe("research-timeouts", () => {
  afterEach(() => {
    delete process.env.RESEARCH_TIMEOUT_CLAMP;
    delete process.env.NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP;
    delete process.env.RESEARCH_ROUTE_MAX_DURATION_SEC;
    delete process.env.BROWSERBASE_SESSION_TIMEOUT_SEC;
    delete process.env.RESEARCH_OVERALL_TIMEOUT_MS;
    delete process.env.RESEARCH_GOTO_TIMEOUT_MS;
    delete process.env.RESEARCH_EXTRACT_TIMEOUT_MS;
    delete process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS;
  });

  it("defaults to clamp mode with Hobby-safe budgets", () => {
    expect(researchTimeoutClampMode()).toBe("clamp");
    expect(isResearchTimeoutClampEnabled()).toBe(true);
    expect(researchRouteMaxDurationSec()).toBe(RESEARCH_HOBBY_MAX_DURATION_SEC);
    expect(researchPlatformBudgetMs()).toBe(285_000);
    expect(browserbaseSessionTimeoutSec()).toBe(285);
    expect(researchOverallTimeoutMs()).toBe(270_000);
    expect(researchGotoTimeoutMs()).toBe(45_000);
    expect(researchExtractTimeoutMs()).toBe(60_000);
    expect(researchClientAbortTimeoutMs()).toBe(285_000);
  });

  it("treats clamp aliases as Hobby clamp", () => {
    process.env.RESEARCH_TIMEOUT_CLAMP = "hobby";
    expect(researchTimeoutClampMode()).toBe("clamp");
    process.env.RESEARCH_TIMEOUT_CLAMP = "true";
    expect(researchTimeoutClampMode()).toBe("clamp");
  });

  it("reads env overrides within the platform cap when clamped", () => {
    process.env.BROWSERBASE_SESSION_TIMEOUT_SEC = "240";
    process.env.RESEARCH_OVERALL_TIMEOUT_MS = "200000";
    process.env.RESEARCH_GOTO_TIMEOUT_MS = "30000";
    process.env.RESEARCH_EXTRACT_TIMEOUT_MS = "45000";
    process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS = "250000";

    expect(browserbaseSessionTimeoutSec()).toBe(240);
    expect(researchOverallTimeoutMs()).toBe(200_000);
    expect(researchGotoTimeoutMs()).toBe(30_000);
    expect(researchExtractTimeoutMs()).toBe(45_000);
    expect(researchClientAbortTimeoutMs()).toBe(250_000);
  });

  it("clamps env overrides that exceed the Hobby platform budget", () => {
    process.env.BROWSERBASE_SESSION_TIMEOUT_SEC = "900";
    process.env.RESEARCH_OVERALL_TIMEOUT_MS = "720000";
    process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS = "800000";

    expect(browserbaseSessionTimeoutSec()).toBe(300);
    expect(researchOverallTimeoutMs()).toBe(285_000);
    expect(researchClientAbortTimeoutMs()).toBe(300_000);
  });

  it("skips platform caps when RESEARCH_TIMEOUT_CLAMP=no_clamp", () => {
    process.env.RESEARCH_TIMEOUT_CLAMP = "no_clamp";
    process.env.BROWSERBASE_SESSION_TIMEOUT_SEC = "780";
    process.env.RESEARCH_OVERALL_TIMEOUT_MS = "720000";
    process.env.RESEARCH_EXTRACT_TIMEOUT_MS = "180000";
    process.env.NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS = "750000";

    expect(researchTimeoutClampMode()).toBe("no_clamp");
    expect(isResearchTimeoutClampEnabled()).toBe(false);
    expect(researchRouteMaxDurationSec()).toBe(800);
    expect(browserbaseSessionTimeoutSec()).toBe(780);
    expect(researchOverallTimeoutMs()).toBe(720_000);
    expect(researchExtractTimeoutMs()).toBe(180_000);
    expect(researchClientAbortTimeoutMs()).toBe(750_000);
  });

  it("uses long-running defaults when no_clamp and budgets unset", () => {
    process.env.NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP = "no_clamp";

    expect(browserbaseSessionTimeoutSec()).toBe(780);
    expect(researchOverallTimeoutMs()).toBe(720_000);
    expect(researchGotoTimeoutMs()).toBe(60_000);
    expect(researchExtractTimeoutMs()).toBe(180_000);
    expect(researchClientAbortTimeoutMs()).toBe(750_000);
  });

  it("allows RESEARCH_ROUTE_MAX_DURATION_SEC override when no_clamp", () => {
    process.env.RESEARCH_TIMEOUT_CLAMP = "off";
    process.env.RESEARCH_ROUTE_MAX_DURATION_SEC = "900";
    expect(researchRouteMaxDurationSec()).toBe(900);
  });

  it("ignores invalid env values", () => {
    process.env.BROWSERBASE_SESSION_TIMEOUT_SEC = "nope";
    expect(browserbaseSessionTimeoutSec()).toBe(285);
  });
});
