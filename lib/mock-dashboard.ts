/**
 * Mock dashboard data for Feature 14 UI.
 * Features 15–17 swap these props with live InsForge / PostHog sources.
 */

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

export type DaySeriesPoint = {
  day: string;
  count: number;
};

export type MatchBucketPoint = {
  range: string;
  count: number;
};

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalJobsFound: {
    value: 284,
    format: "number",
    trend: { percent: 12, label: "vs last week" },
  },
  avgMatchRate: {
    value: 82,
    format: "percent",
    trend: { percent: 3, label: "vs last week" },
  },
  companiesResearched: {
    value: 35,
    format: "number",
    subtext: "Total researched.",
  },
  jobsThisWeek: {
    value: 28,
    format: "number",
    subtext: "New this week.",
  },
};

export const MOCK_DASHBOARD_ACTIVITY: DashboardActivityItem[] = [
  {
    id: "act-1",
    type: "job_found",
    message: "Found 8 jobs for Frontend Engineer",
    timeAgo: "10 mins ago",
  },
  {
    id: "act-2",
    type: "company_researched",
    message: "Researched Stripe",
    timeAgo: "1 hour ago",
  },
  {
    id: "act-3",
    type: "job_found",
    message: "Found 12 jobs for React Developer",
    timeAgo: "2 hours ago",
  },
  {
    id: "act-4",
    type: "company_researched",
    message: "Researched Vercel",
    timeAgo: "Yesterday",
  },
  {
    id: "act-5",
    type: "job_found",
    message: "Found 10 jobs for Full Stack Engineer",
    timeAgo: "Yesterday",
  },
];

/** Company research counts by weekday (design peaks Friday). */
export const MOCK_RESEARCH_ACTIVITY: DaySeriesPoint[] = [
  { day: "Mon", count: 4 },
  { day: "Tue", count: 6 },
  { day: "Wed", count: 3 },
  { day: "Thu", count: 8 },
  { day: "Fri", count: 12 },
  { day: "Sat", count: 5 },
  { day: "Sun", count: 1 },
];

/** Jobs found by weekday (design peaks Friday ~85). */
export const MOCK_JOBS_OVER_TIME: DaySeriesPoint[] = [
  { day: "Mon", count: 42 },
  { day: "Tue", count: 58 },
  { day: "Wed", count: 38 },
  { day: "Thu", count: 52 },
  { day: "Fri", count: 85 },
  { day: "Sat", count: 55 },
  { day: "Sun", count: 32 },
];

/** Match score histogram (design peaks 80–90%). */
export const MOCK_MATCH_DISTRIBUTION: MatchBucketPoint[] = [
  { range: "50-60%", count: 12 },
  { range: "60-70%", count: 28 },
  { range: "70-80%", count: 48 },
  { range: "80-90%", count: 85 },
  { range: "90-100%", count: 42 },
];

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
