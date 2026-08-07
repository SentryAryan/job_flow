import { describe, expect, it } from "vitest";

import {
    ACTIVITY_FEED_LIMIT,
    buildActivityFeed,
    computeDashboardStats,
    EMPTY_DASHBOARD_STATS,
    formatActivityTimeAgo,
    type DashboardJobStatRow,
    type DashboardResearchActivityRow,
    type DashboardRunActivityRow,
} from "@/lib/dashboard";

describe("computeDashboardStats", () => {
  const weekAgo = new Date("2026-08-06T12:00:00.000Z");

  it("returns zeros for an empty job list", () => {
    expect(computeDashboardStats([], weekAgo)).toEqual(EMPTY_DASHBOARD_STATS);
  });

  it("counts totals, researched, and this-week jobs", () => {
    const rows: DashboardJobStatRow[] = [
      {
        match_score: 90,
        company_research: { companyOverview: "x" },
        found_at: "2026-08-05T10:00:00.000Z",
      },
      {
        match_score: 80,
        company_research: null,
        found_at: "2026-07-20T10:00:00.000Z",
      },
      {
        match_score: null,
        company_research: { companyOverview: "y" },
        found_at: "2026-08-01T10:00:00.000Z",
      },
    ];

    const stats = computeDashboardStats(rows, weekAgo);
    expect(stats.totalJobsFound.value).toBe(3);
    expect(stats.avgMatchRate.value).toBe(85);
    expect(stats.avgMatchRate.format).toBe("percent");
    expect(stats.companiesResearched.value).toBe(2);
    expect(stats.companiesResearched.subtext).toBe("Total researched.");
    expect(stats.jobsThisWeek.value).toBe(2);
    expect(stats.jobsThisWeek.subtext).toBe("New this week.");
    expect(stats.totalJobsFound.trend).toBeUndefined();
    expect(stats.avgMatchRate.trend).toBeUndefined();
  });

  it("rounds average match rate and ignores null scores", () => {
    const rows: DashboardJobStatRow[] = [
      {
        match_score: 91,
        company_research: null,
        found_at: "2026-08-05T10:00:00.000Z",
      },
      {
        match_score: 80,
        company_research: null,
        found_at: "2026-08-05T11:00:00.000Z",
      },
      {
        match_score: null,
        company_research: null,
        found_at: "2026-08-05T12:00:00.000Z",
      },
    ];
    // (91 + 80) / 2 = 85.5 → 86
    expect(computeDashboardStats(rows, weekAgo).avgMatchRate.value).toBe(86);
  });

  it("returns 0 avg when all match scores are null", () => {
    const rows: DashboardJobStatRow[] = [
      {
        match_score: null,
        company_research: null,
        found_at: "2026-08-05T10:00:00.000Z",
      },
    ];
    expect(computeDashboardStats(rows, weekAgo).avgMatchRate.value).toBe(0);
  });

  it("includes jobs found exactly at the 7-day boundary", () => {
    const rows: DashboardJobStatRow[] = [
      {
        match_score: 70,
        company_research: null,
        found_at: "2026-07-30T12:00:00.000Z",
      },
      {
        match_score: 70,
        company_research: null,
        found_at: "2026-07-30T11:59:59.000Z",
      },
    ];
    expect(computeDashboardStats(rows, weekAgo).jobsThisWeek.value).toBe(1);
  });
});

describe("formatActivityTimeAgo", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");

  it("formats minutes under one hour", () => {
    expect(
      formatActivityTimeAgo("2026-08-06T11:50:00.000Z", now),
    ).toBe("10 mins ago");
    expect(
      formatActivityTimeAgo("2026-08-06T11:59:00.000Z", now),
    ).toBe("1 min ago");
  });

  it("formats hours and days like the find-jobs helper", () => {
    expect(
      formatActivityTimeAgo("2026-08-06T10:00:00.000Z", now),
    ).toBe("2 hours ago");
    expect(
      formatActivityTimeAgo("2026-08-05T12:00:00.000Z", now),
    ).toBe("Yesterday");
    expect(
      formatActivityTimeAgo("2026-08-03T12:00:00.000Z", now),
    ).toBe("3 days ago");
  });

  it("returns Just now for sub-minute diffs", () => {
    expect(
      formatActivityTimeAgo("2026-08-06T11:59:30.000Z", now),
    ).toBe("Just now");
  });
});

describe("buildActivityFeed", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");

  const runs: DashboardRunActivityRow[] = [
    {
      id: "run-1",
      job_title_searched: "Frontend Engineer",
      jobs_found: 8,
      completed_at: "2026-08-06T11:50:00.000Z",
      started_at: "2026-08-06T11:40:00.000Z",
    },
    {
      id: "run-2",
      job_title_searched: null,
      jobs_found: 3,
      completed_at: null,
      started_at: "2026-08-06T08:00:00.000Z",
    },
  ];

  const researched: DashboardResearchActivityRow[] = [
    {
      id: "job-1",
      company: "Stripe",
      researched_at: "2026-08-06T11:00:00.000Z",
    },
    {
      id: "job-2",
      company: null,
      researched_at: "2026-08-05T12:00:00.000Z",
    },
  ];

  it("merges runs and research sorted by time descending", () => {
    const feed = buildActivityFeed(runs, researched, now);
    expect(feed.map((a) => a.id)).toEqual([
      "run-run-1",
      "job-job-1",
      "run-run-2",
      "job-job-2",
    ]);
    expect(feed[0]).toMatchObject({
      type: "job_found",
      message: "Found 8 jobs for Frontend Engineer",
      timeAgo: "10 mins ago",
    });
    expect(feed[1]).toMatchObject({
      type: "company_researched",
      message: "Researched Stripe",
      timeAgo: "1 hour ago",
    });
  });

  it("uses fallbacks for null title and company", () => {
    const feed = buildActivityFeed(
      [
        {
          id: "run-x",
          job_title_searched: null,
          jobs_found: 1,
          completed_at: "2026-08-06T11:00:00.000Z",
          started_at: "2026-08-06T10:00:00.000Z",
        },
      ],
      [
        {
          id: "job-x",
          company: "  ",
          researched_at: "2026-08-06T10:00:00.000Z",
        },
      ],
      now,
    );
    expect(feed[0]!.message).toBe("Found 1 job for your search");
    expect(feed[1]!.message).toBe("Researched Unknown company");
  });

  it(`limits the feed to ${ACTIVITY_FEED_LIMIT} items`, () => {
    const manyRuns: DashboardRunActivityRow[] = Array.from(
      { length: 8 },
      (_, i) => ({
        id: `run-${i}`,
        job_title_searched: `Role ${i}`,
        jobs_found: i,
        completed_at: new Date(now.getTime() - i * 60_000).toISOString(),
        started_at: new Date(now.getTime() - i * 60_000).toISOString(),
      }),
    );
    expect(buildActivityFeed(manyRuns, [], now)).toHaveLength(
      ACTIVITY_FEED_LIMIT,
    );
  });

  it("skips research rows without researched_at", () => {
    const feed = buildActivityFeed(
      [],
      [
        {
          id: "job-missing",
          company: "Ghost",
          researched_at: null,
        },
      ],
      now,
    );
    expect(feed).toEqual([]);
  });
});
