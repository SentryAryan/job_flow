import { describe, expect, it } from "vitest";

import {
  DEFAULT_DASHBOARD_CHART_RANGE,
  chartRangeSinceIso,
  chartRangeWindowDays,
  isDashboardChartRange,
  parseDashboardChartRange,
} from "@/lib/dashboard-range";

describe("parseDashboardChartRange", () => {
  it("accepts known ranges", () => {
    expect(parseDashboardChartRange("7d")).toBe("7d");
    expect(parseDashboardChartRange("30d")).toBe("30d");
    expect(parseDashboardChartRange("60d")).toBe("60d");
    expect(parseDashboardChartRange("all")).toBe("all");
  });

  it("defaults invalid or missing values to 30d", () => {
    expect(parseDashboardChartRange(null)).toBe(DEFAULT_DASHBOARD_CHART_RANGE);
    expect(parseDashboardChartRange(undefined)).toBe(
      DEFAULT_DASHBOARD_CHART_RANGE,
    );
    expect(parseDashboardChartRange("")).toBe(DEFAULT_DASHBOARD_CHART_RANGE);
    expect(parseDashboardChartRange("90d")).toBe(DEFAULT_DASHBOARD_CHART_RANGE);
  });
});

describe("isDashboardChartRange", () => {
  it("narrows valid strings", () => {
    expect(isDashboardChartRange("7d")).toBe(true);
    expect(isDashboardChartRange("nope")).toBe(false);
  });
});

describe("chartRangeSinceIso", () => {
  const now = new Date("2026-08-06T15:30:00.000Z");

  it("returns null for all time", () => {
    expect(chartRangeSinceIso("all", now)).toBeNull();
  });

  it("returns start of UTC day for the first day of the window", () => {
    // 30d ending 2026-08-06 → first day 2026-07-08
    expect(chartRangeSinceIso("30d", now)).toBe("2026-07-08T00:00:00.000Z");
    expect(chartRangeSinceIso("7d", now)).toBe("2026-07-31T00:00:00.000Z");
    expect(chartRangeSinceIso("60d", now)).toBe("2026-06-08T00:00:00.000Z");
  });
});

describe("chartRangeWindowDays", () => {
  it("maps fixed windows and null for all", () => {
    expect(chartRangeWindowDays("7d")).toBe(7);
    expect(chartRangeWindowDays("30d")).toBe(30);
    expect(chartRangeWindowDays("60d")).toBe(60);
    expect(chartRangeWindowDays("all")).toBeNull();
  });
});
