/**
 * Mock dashboard data retained for Feature 14 snapshot tests.
 * Live stats/activity: lib/dashboard.ts. Live charts: lib/dashboard-charts.ts.
 */

export type {
  DashboardActivityItem,
  DashboardActivityType,
  DashboardStat,
  DashboardStats,
  DashboardTrend,
} from "@/lib/dashboard";

export {
  activityDotClasses,
  formatStatValue,
  formatTrendPercent,
  trendBadgeClasses,
} from "@/lib/dashboard";

export type {
  DaySeriesPoint,
  MatchBucketPoint,
} from "@/lib/dashboard-charts";

import type {
  DashboardActivityItem,
  DashboardStats,
} from "@/lib/dashboard";
import type {
  DaySeriesPoint,
  MatchBucketPoint,
} from "@/lib/dashboard-charts";

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
