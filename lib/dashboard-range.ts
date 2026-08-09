/**
 * Shared dashboard chart time-range (InsForge charts + PostHog insights).
 */

export const DASHBOARD_CHART_RANGES = ["7d", "30d", "60d", "all"] as const;

export type DashboardChartRange = (typeof DASHBOARD_CHART_RANGES)[number];

export const DEFAULT_DASHBOARD_CHART_RANGE: DashboardChartRange = "30d";

export const DASHBOARD_CHART_RANGE_LABELS: Record<DashboardChartRange, string> =
  {
    "7d": "Past 7 days",
    "30d": "Past 30 days",
    "60d": "Past 60 days",
    all: "All time",
  };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const RANGE_DAYS: Record<Exclude<DashboardChartRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
};

export function isDashboardChartRange(
  value: unknown,
): value is DashboardChartRange {
  return (
    typeof value === "string" &&
    (DASHBOARD_CHART_RANGES as readonly string[]).includes(value)
  );
}

/**
 * Parse `range` from a URLSearchParams / query string.
 * Invalid or missing → default `30d`.
 */
export function parseDashboardChartRange(
  raw: string | null | undefined,
): DashboardChartRange {
  if (isDashboardChartRange(raw)) return raw;
  return DEFAULT_DASHBOARD_CHART_RANGE;
}

/**
 * Inclusive lower bound for filters: ISO timestamp at start of UTC day
 * `windowDays` ago. `all` → null (no lower bound).
 */
export function chartRangeSinceIso(
  range: DashboardChartRange,
  now: Date = new Date(),
): string | null {
  if (range === "all") return null;
  const days = RANGE_DAYS[range];
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end.getTime() - (days - 1) * MS_PER_DAY);
  return start.toISOString();
}

/** Window length for zero-filled series; null for all-time sparse series. */
export function chartRangeWindowDays(
  range: DashboardChartRange,
): number | null {
  if (range === "all") return null;
  return RANGE_DAYS[range];
}
