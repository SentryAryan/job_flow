/**
 * Dashboard stats + recent activity (Features 15–16).
 * Chart series mocks remain in mock-dashboard.ts until Feature 17.
 */

import { authedFetch } from "@/lib/authed-fetch";

export type DashboardActivityType = "job_found" | "company_researched";

export type DashboardTrend = {
  /** Signed delta vs prior period (positive = up, negative = down). */
  percent: number;
  label: string;
};

export type DashboardStat = {
  value: number;
  format?: "number" | "percent";
  trend?: DashboardTrend;
  subtext?: string;
};

export type DashboardStats = {
  totalJobsFound: DashboardStat;
  avgMatchRate: DashboardStat;
  companiesResearched: DashboardStat;
  jobsThisWeek: DashboardStat;
};

export type DashboardActivityItem = {
  id: string;
  type: DashboardActivityType;
  message: string;
  timeAgo: string;
};

export type DashboardSummary = {
  stats: DashboardStats;
  activity: DashboardActivityItem[];
};

export type DashboardJobStatRow = {
  match_score: number | null;
  company_research: unknown | null;
  found_at: string;
};

export type DashboardRunActivityRow = {
  id: string;
  job_title_searched: string | null;
  jobs_found: number;
  completed_at: string | null;
  started_at: string;
};

export type DashboardResearchActivityRow = {
  id: string;
  company: string | null;
  researched_at: string | null;
};

export const ACTIVITY_FEED_LIMIT = 5;

/** Fetch a few extra from each source before merge so top-N stays accurate. */
export const ACTIVITY_SOURCE_FETCH_LIMIT = 10;

/** Safety cap on jobs rows loaded for dashboard stats (personal-scale). */
export const DASHBOARD_JOBS_FETCH_LIMIT = 5000;

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const WEEK_MS = 7 * MS_PER_DAY;

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalJobsFound: { value: 0, format: "number" },
  avgMatchRate: { value: 0, format: "percent" },
  companiesResearched: {
    value: 0,
    format: "number",
    subtext: "Total researched.",
  },
  jobsThisWeek: {
    value: 0,
    format: "number",
    subtext: "New this week.",
  },
};

export function computeDashboardStats(
  rows: DashboardJobStatRow[],
  now: Date = new Date(),
): DashboardStats {
  if (rows.length === 0) {
    return EMPTY_DASHBOARD_STATS;
  }

  const weekStartMs = now.getTime() - WEEK_MS;
  let scoreSum = 0;
  let scoreCount = 0;
  let researched = 0;
  let thisWeek = 0;

  for (const row of rows) {
    if (typeof row.match_score === "number" && Number.isFinite(row.match_score)) {
      scoreSum += row.match_score;
      scoreCount += 1;
    }
    if (row.company_research != null) {
      researched += 1;
    }
    const foundMs = Date.parse(row.found_at);
    if (Number.isFinite(foundMs) && foundMs >= weekStartMs) {
      thisWeek += 1;
    }
  }

  const avg =
    scoreCount === 0 ? 0 : Math.round(scoreSum / scoreCount);

  return {
    totalJobsFound: { value: rows.length, format: "number" },
    avgMatchRate: { value: avg, format: "percent" },
    companiesResearched: {
      value: researched,
      format: "number",
      subtext: "Total researched.",
    },
    jobsThisWeek: {
      value: thisWeek,
      format: "number",
      subtext: "New this week.",
    },
  };
}

/** Minutes-aware relative time for the activity feed. */
export function formatActivityTimeAgo(
  isoDate: string,
  now: Date = new Date(),
): string {
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffMs / MS_PER_MINUTE);
  const diffHours = Math.floor(diffMs / MS_PER_HOUR);
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 min ago" : `${diffMinutes} mins ago`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

type InternalActivity = {
  id: string;
  type: DashboardActivityType;
  message: string;
  occurredAtMs: number;
};

function runOccurredAt(run: DashboardRunActivityRow): number {
  const completed = run.completed_at ? Date.parse(run.completed_at) : NaN;
  if (Number.isFinite(completed)) return completed;
  const started = Date.parse(run.started_at);
  return Number.isFinite(started) ? started : 0;
}

function formatRunMessage(run: DashboardRunActivityRow): string {
  const title = run.job_title_searched?.trim() || "your search";
  const count = run.jobs_found;
  const noun = count === 1 ? "job" : "jobs";
  return `Found ${count} ${noun} for ${title}`;
}

function formatResearchMessage(row: DashboardResearchActivityRow): string {
  const company = row.company?.trim() || "Unknown company";
  return `Researched ${company}`;
}

export function buildActivityFeed(
  runs: DashboardRunActivityRow[],
  researched: DashboardResearchActivityRow[],
  now: Date = new Date(),
): DashboardActivityItem[] {
  const items: InternalActivity[] = [];

  for (const run of runs) {
    items.push({
      id: `run-${run.id}`,
      type: "job_found",
      message: formatRunMessage(run),
      occurredAtMs: runOccurredAt(run),
    });
  }

  for (const job of researched) {
    if (!job.researched_at) continue;
    const occurredAtMs = Date.parse(job.researched_at);
    if (!Number.isFinite(occurredAtMs)) continue;
    items.push({
      id: `job-${job.id}`,
      type: "company_researched",
      message: formatResearchMessage(job),
      occurredAtMs,
    });
  }

  return items
    .slice()
    .sort((a, b) => b.occurredAtMs - a.occurredAtMs)
    .slice(0, ACTIVITY_FEED_LIMIT)
    .map((item) => ({
      id: item.id,
      type: item.type,
      message: item.message,
      timeAgo: formatActivityTimeAgo(
        new Date(item.occurredAtMs).toISOString(),
        now,
      ),
    }));
}

export function activityDotClasses(type: DashboardActivityType): {
  ring: string;
  dot: string;
} {
  switch (type) {
    case "job_found":
      return { ring: "bg-success-light", dot: "bg-success-alt" };
    case "company_researched":
      return { ring: "bg-info-light", dot: "bg-info" };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function formatStatValue(
  value: number,
  format: "number" | "percent" = "number",
): string {
  if (format === "percent") {
    return `${value}%`;
  }
  return String(value);
}

/** Renders signed trend text (e.g. +12%, -3%, 0%). */
export function formatTrendPercent(percent: number): string {
  if (percent > 0) {
    return `+${percent}%`;
  }
  return `${percent}%`;
}

export function trendBadgeClasses(percent: number): string {
  if (percent < 0) {
    return "bg-error/10 text-error";
  }
  return "bg-success-lightest text-success-darker";
}

export type FetchDashboardSummaryResult =
  | { success: true; data: DashboardSummary }
  | { success: false; error: string };

/**
 * Client fetch for GET /api/dashboard (Bearer JWT via authedFetch).
 */
export async function fetchDashboardSummary(): Promise<FetchDashboardSummaryResult> {
  try {
    const response = await authedFetch("/api/dashboard", {
      method: "GET",
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      success?: boolean;
      data?: DashboardSummary;
      error?: string | null;
    };

    if (!response.ok || !payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "Could not load dashboard. Please try again.",
      };
    }

    return { success: true, data: payload.data };
  } catch {
    return {
      success: false,
      error: "Could not load dashboard. Please try again.",
    };
  }
}
