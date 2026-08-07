import { describe, expect, it } from "vitest";

import {
    MATCH_BUCKET_RANGES,
    bucketMatchScores,
    buildDaySeries,
    chartYDomainMax,
    emptyMatchDistribution,
    isChartSeriesEmpty,
    parseMatchScore,
} from "@/lib/dashboard-charts";

describe("buildDaySeries", () => {
  const now = new Date("2026-08-06T15:30:00.000Z");

  it("zero-fills a 7-day window with M/D labels ending today UTC", () => {
    const series = buildDaySeries(
      7,
      new Map([
        ["2026-08-06", 3],
        ["2026-08-04", 1],
      ]),
      now,
    );
    expect(series).toHaveLength(7);
    expect(series[0]).toEqual({ day: "7/31", count: 0 });
    expect(series[4]).toEqual({ day: "8/4", count: 1 });
    expect(series[6]).toEqual({ day: "8/6", count: 3 });
  });

  it("builds a 30-day window", () => {
    const series = buildDaySeries(30, new Map(), now);
    expect(series).toHaveLength(30);
    expect(series[0]!.day).toBe("7/8");
    expect(series[29]!.day).toBe("8/6");
    expect(series.every((p) => p.count === 0)).toBe(true);
  });
});

describe("parseMatchScore", () => {
  it("parses numbers and numeric strings", () => {
    expect(parseMatchScore(85)).toBe(85);
    expect(parseMatchScore("90")).toBe(90);
    expect(parseMatchScore("82.4")).toBe(82);
  });

  it("returns null for invalid values", () => {
    expect(parseMatchScore(null)).toBeNull();
    expect(parseMatchScore(undefined)).toBeNull();
    expect(parseMatchScore("")).toBeNull();
    expect(parseMatchScore("abc")).toBeNull();
  });
});

describe("bucketMatchScores", () => {
  it("returns empty buckets when no scores", () => {
    expect(bucketMatchScores([])).toEqual(emptyMatchDistribution());
    expect(bucketMatchScores([]).map((b) => b.range)).toEqual([
      ...MATCH_BUCKET_RANGES,
    ]);
  });

  it("buckets inclusive ranges and ignores out-of-range scores", () => {
    const buckets = bucketMatchScores([
      49, 50, 59, 60, 79, 80, 89, 90, 100, 101,
    ]);
    const byRange = Object.fromEntries(buckets.map((b) => [b.range, b.count]));
    expect(byRange["50-60%"]).toBe(2);
    expect(byRange["60-70%"]).toBe(1);
    expect(byRange["70-80%"]).toBe(1);
    expect(byRange["80-90%"]).toBe(2);
    expect(byRange["90-100%"]).toBe(2);
  });

  it("coerces string scores from PostHog properties", () => {
    const buckets = bucketMatchScores(["85", "92", null, "x"]);
    expect(buckets.find((b) => b.range === "80-90%")!.count).toBe(1);
    expect(buckets.find((b) => b.range === "90-100%")!.count).toBe(1);
  });
});

describe("isChartSeriesEmpty", () => {
  it("is true when all counts are zero", () => {
    expect(isChartSeriesEmpty([{ day: "8/1", count: 0 }])).toBe(true);
    expect(isChartSeriesEmpty(emptyMatchDistribution())).toBe(true);
  });

  it("is false when any count is positive", () => {
    expect(isChartSeriesEmpty([{ day: "8/1", count: 1 }])).toBe(false);
  });

  it("is true for empty arrays", () => {
    expect(isChartSeriesEmpty([])).toBe(true);
  });
});

describe("chartYDomainMax", () => {
  it("floors at 4 and follows the series max", () => {
    expect(chartYDomainMax([{ count: 0 }])).toBe(4);
    expect(chartYDomainMax([{ count: 12 }])).toBe(12);
  });
});
