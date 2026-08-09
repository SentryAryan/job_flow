import {
    buildDaySeriesForRange,
    countsMapFromDayRows,
    emptyDaySeries,
} from "@/lib/dashboard-charts";
import {
    jsonError,
    jsonOk,
    requireChartAuth,
} from "@/lib/dashboard-charts-api";
import {
    emptyDashboardInsights,
    FEATURE_USAGE_KEYS,
    mapFeatureUsageCounts,
    type FeatureUsageKey,
} from "@/lib/dashboard-insights";
import {
    chartRangeWindowDays,
} from "@/lib/dashboard-range";
import { isTransientError } from "@/lib/errors";
import {
    escapeHogqlString,
    getPostHogQueryConfig,
    queryHogQL,
    rowsToObjects,
} from "@/lib/posthog-query";

export const runtime = "nodejs";

function dailyEventSql(
  eventName: string,
  userId: string,
  windowDays: number | null,
): string {
  const id = escapeHogqlString(userId);
  const event = escapeHogqlString(eventName);
  const sinceClause =
    windowDays != null
      ? `AND timestamp >= now() - INTERVAL ${windowDays} DAY`
      : "";
  return `
SELECT toDate(timestamp) AS day, count() AS count
FROM events
WHERE event = '${event}'
  AND distinct_id = '${id}'
  ${sinceClause}
GROUP BY day
ORDER BY day
`.trim();
}

function featureCountSql(
  eventName: string,
  userId: string,
  windowDays: number | null,
): string {
  const id = escapeHogqlString(userId);
  const event = escapeHogqlString(eventName);
  const sinceClause =
    windowDays != null
      ? `AND timestamp >= now() - INTERVAL ${windowDays} DAY`
      : "";
  return `
SELECT count() AS count
FROM events
WHERE event = '${event}'
  AND distinct_id = '${id}'
  ${sinceClause}
`.trim();
}

/**
 * GET /api/dashboard/insights?range=7d|30d|60d|all
 * PostHog product engagement (searches + feature usage).
 */
export async function GET(request: Request) {
  const auth = await requireChartAuth(request);
  if (!auth.ok) return auth.response;

  const now = new Date();
  const windowDays = chartRangeWindowDays(auth.range);
  const emptySeries =
    windowDays != null ? emptyDaySeries(windowDays, now) : [];

  const config = getPostHogQueryConfig();
  if (!config) {
    console.warn(
      "[api/dashboard/insights] POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID missing; returning empty series",
    );
    return jsonOk(emptyDashboardInsights(emptySeries));
  }

  try {
    const [searchesDaily, ...featureResults] = await Promise.all([
      queryHogQL(
        dailyEventSql("job_search_started", auth.userId, windowDays),
        config,
      ),
      ...FEATURE_USAGE_KEYS.map((event) =>
        queryHogQL(featureCountSql(event, auth.userId, windowDays), config),
      ),
    ]);

    const searchRows = rowsToObjects(
      searchesDaily.columns,
      searchesDaily.results,
    );
    const jobSearchesOverTime = buildDaySeriesForRange(
      auth.range,
      countsMapFromDayRows(
        searchRows.map((r) => ({ day: r.day, count: r.count })),
      ),
      now,
    );

    const featureCounts: Partial<Record<FeatureUsageKey, number>> = {};
    FEATURE_USAGE_KEYS.forEach((key, index) => {
      const result = featureResults[index]!;
      const rows = rowsToObjects(result.columns, result.results);
      const raw = rows[0]?.count;
      const count =
        typeof raw === "number" && Number.isFinite(raw)
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : 0;
      featureCounts[key] = Number.isFinite(count) ? count : 0;
    });

    return jsonOk({
      jobSearchesOverTime:
        jobSearchesOverTime.length === 0 && windowDays != null
          ? emptySeries
          : jobSearchesOverTime,
      featureUsage: mapFeatureUsageCounts(featureCounts),
    });
  } catch (error) {
    console.error("[api/dashboard/insights]", error);
    if (isTransientError(error)) {
      return jsonError(504, "Insights service timed out. Please try again.");
    }
    return jsonError(502, "Could not load insights. Please try again.");
  }
}
