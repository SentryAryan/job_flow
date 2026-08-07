/**
 * Dashboard analytics chart series (Feature 17 — PostHog).
 */

import { authedFetch } from "@/lib/authed-fetch";

export type DaySeriesPoint = {
  day: string;
  count: number;
};

export type MatchBucketPoint = {
  range: string;
  count: number;
};

export type DashboardChartsData = {
  jobsOverTime: DaySeriesPoint[];
  matchDistribution: MatchBucketPoint[];
  researchActivity: DaySeriesPoint[];
};

export const JOBS_OVER_TIME_DAYS = 30;
export const RESEARCH_ACTIVITY_DAYS = 7;

export const MATCH_BUCKET_RANGES = [
  "50-60%",
  "60-70%",
  "70-80%",
  "80-90%",
  "90-100%",
] as const;

export type MatchBucketRange = (typeof MATCH_BUCKET_RANGES)[number];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC calendar date as YYYY-MM-DD. */
export function toIsoDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Label format M/D (no leading zeros), UTC. */
export function formatChartDayLabel(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Zero-fill a trailing window of calendar days ending on `now` (UTC).
 * `countsByIsoDate` keys are YYYY-MM-DD.
 */
export function buildDaySeries(
  windowDays: number,
  countsByIsoDate: Map<string, number>,
  now: Date = new Date(),
): DaySeriesPoint[] {
  const end = startOfUtcDay(now);
  const points: DaySeriesPoint[] = [];

  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const day = new Date(end.getTime() - i * MS_PER_DAY);
    const iso = toIsoDateUTC(day);
    points.push({
      day: formatChartDayLabel(day),
      count: countsByIsoDate.get(iso) ?? 0,
    });
  }

  return points;
}

export function emptyMatchDistribution(): MatchBucketPoint[] {
  return MATCH_BUCKET_RANGES.map((range) => ({ range, count: 0 }));
}

export function emptyDaySeries(
  windowDays: number,
  now: Date = new Date(),
): DaySeriesPoint[] {
  return buildDaySeries(windowDays, new Map(), now);
}

export function emptyDashboardCharts(
  now: Date = new Date(),
): DashboardChartsData {
  return {
    jobsOverTime: emptyDaySeries(JOBS_OVER_TIME_DAYS, now),
    matchDistribution: emptyMatchDistribution(),
    researchActivity: emptyDaySeries(RESEARCH_ACTIVITY_DAYS, now),
  };
}

export function parseMatchScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function bucketForScore(score: number): MatchBucketRange | null {
  if (score >= 50 && score < 60) return "50-60%";
  if (score >= 60 && score < 70) return "60-70%";
  if (score >= 70 && score < 80) return "70-80%";
  if (score >= 80 && score < 90) return "80-90%";
  if (score >= 90 && score <= 100) return "90-100%";
  return null;
}

/** Histogram of match scores into fixed dashboard buckets. */
export function bucketMatchScores(scores: unknown[]): MatchBucketPoint[] {
  const counts = new Map<MatchBucketRange, number>(
    MATCH_BUCKET_RANGES.map((r) => [r, 0]),
  );

  for (const raw of scores) {
    const score = parseMatchScore(raw);
    if (score == null) continue;
    const bucket = bucketForScore(score);
    if (!bucket) continue;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return MATCH_BUCKET_RANGES.map((range) => ({
    range,
    count: counts.get(range) ?? 0,
  }));
}

export function isChartSeriesEmpty(
  series: ReadonlyArray<{ count: number }>,
): boolean {
  if (series.length === 0) return true;
  return series.every((p) => p.count === 0);
}

/** Y-axis max: at least 4, otherwise ceil to a readable step. */
export function chartYDomainMax(series: ReadonlyArray<{ count: number }>): number {
  const max = series.reduce((acc, p) => Math.max(acc, p.count), 0);
  return Math.max(4, max);
}

export type FetchDashboardChartsResult =
  | { success: true; data: DashboardChartsData }
  | { success: false; error: string };

/**
 * Client fetch for GET /api/dashboard/charts (Bearer JWT via authedFetch).
 */
export async function fetchDashboardCharts(): Promise<FetchDashboardChartsResult> {
  try {
    const response = await authedFetch("/api/dashboard/charts", {
      method: "GET",
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      success?: boolean;
      data?: DashboardChartsData;
      error?: string | null;
    };

    if (!response.ok || !payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "Could not load charts. Please try again.",
      };
    }

    return { success: true, data: payload.data };
  } catch {
    return {
      success: false,
      error: "Could not load charts. Please try again.",
    };
  }
}

/** Normalize PostHog day cell (Date / string) to YYYY-MM-DD. */
export function normalizeHogqlDay(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return toIsoDateUTC(value);
  }
  return null;
}

export function countsMapFromDayRows(
  rows: ReadonlyArray<{ day: unknown; count: unknown }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const day = normalizeHogqlDay(row.day);
    if (!day) continue;
    const count =
      typeof row.count === "number" && Number.isFinite(row.count)
        ? row.count
        : typeof row.count === "string"
          ? Number(row.count)
          : NaN;
    if (!Number.isFinite(count)) continue;
    map.set(day, (map.get(day) ?? 0) + count);
  }
  return map;
}
