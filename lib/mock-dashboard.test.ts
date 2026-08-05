import { describe, expect, it } from "vitest";

import {
  MOCK_DASHBOARD_ACTIVITY,
  MOCK_DASHBOARD_STATS,
  MOCK_JOBS_OVER_TIME,
  MOCK_MATCH_DISTRIBUTION,
  MOCK_RESEARCH_ACTIVITY,
  activityDotClasses,
  formatStatValue,
  formatTrendPercent,
  trendBadgeClasses,
} from "@/lib/mock-dashboard";

describe("MOCK_DASHBOARD_STATS", () => {
  it("matches design PNG headline numbers", () => {
    expect(MOCK_DASHBOARD_STATS.totalJobsFound.value).toBe(284);
    expect(MOCK_DASHBOARD_STATS.avgMatchRate.value).toBe(82);
    expect(MOCK_DASHBOARD_STATS.companiesResearched.value).toBe(35);
    expect(MOCK_DASHBOARD_STATS.jobsThisWeek.value).toBe(28);
  });

  it("includes trend badges only on jobs and match rate", () => {
    expect(MOCK_DASHBOARD_STATS.totalJobsFound.trend).toEqual({
      percent: 12,
      label: "vs last week",
    });
    expect(MOCK_DASHBOARD_STATS.avgMatchRate.trend).toEqual({
      percent: 3,
      label: "vs last week",
    });
    expect(MOCK_DASHBOARD_STATS.companiesResearched.trend).toBeUndefined();
    expect(MOCK_DASHBOARD_STATS.companiesResearched.subtext).toBe(
      "Total researched.",
    );
    expect(MOCK_DASHBOARD_STATS.jobsThisWeek.subtext).toBe("New this week.");
  });
});

describe("MOCK_DASHBOARD_ACTIVITY", () => {
  it("has five typed entries for the activity feed", () => {
    expect(MOCK_DASHBOARD_ACTIVITY).toHaveLength(5);
    expect(MOCK_DASHBOARD_ACTIVITY.map((a) => a.type)).toEqual([
      "job_found",
      "company_researched",
      "job_found",
      "company_researched",
      "job_found",
    ]);
  });
});

describe("chart series", () => {
  it("covers Mon–Sun for research and jobs-over-time", () => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    expect(MOCK_RESEARCH_ACTIVITY.map((d) => d.day)).toEqual(days);
    expect(MOCK_JOBS_OVER_TIME.map((d) => d.day)).toEqual(days);
  });

  it("covers match score buckets", () => {
    expect(MOCK_MATCH_DISTRIBUTION.map((d) => d.range)).toEqual([
      "50-60%",
      "60-70%",
      "70-80%",
      "80-90%",
      "90-100%",
    ]);
  });
});

describe("activityDotClasses", () => {
  it("maps job_found to success tokens", () => {
    expect(activityDotClasses("job_found")).toEqual({
      ring: "bg-success-light",
      dot: "bg-success-alt",
    });
  });

  it("maps company_researched to info tokens", () => {
    expect(activityDotClasses("company_researched")).toEqual({
      ring: "bg-info-light",
      dot: "bg-info",
    });
  });
});

describe("formatStatValue", () => {
  it("appends percent for match rate", () => {
    expect(formatStatValue(82, "percent")).toBe("82%");
    expect(formatStatValue(284, "number")).toBe("284");
  });
});

describe("formatTrendPercent", () => {
  it("prefixes plus only for positive deltas", () => {
    expect(formatTrendPercent(12)).toBe("+12%");
    expect(formatTrendPercent(-5)).toBe("-5%");
    expect(formatTrendPercent(0)).toBe("0%");
  });
});

describe("trendBadgeClasses", () => {
  it("uses success tokens for non-negative and error for negative", () => {
    expect(trendBadgeClasses(3)).toContain("success");
    expect(trendBadgeClasses(0)).toContain("success");
    expect(trendBadgeClasses(-2)).toContain("error");
  });
});
