import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import {
    JOBS_OVER_TIME_DAYS,
    RESEARCH_ACTIVITY_DAYS,
    bucketMatchScores,
    buildDaySeries,
    countsMapFromDayRows,
    emptyDashboardCharts,
} from "@/lib/dashboard-charts";
import { isTransientError } from "@/lib/errors";
import {
    escapeHogqlString,
    getPostHogQueryConfig,
    queryHogQL,
    rowsToObjects,
} from "@/lib/posthog-query";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json(
    { success: false, error, data: null },
    { status },
  );
}

function dailyEventSql(eventName: string, userId: string, days: number): string {
  const id = escapeHogqlString(userId);
  const event = escapeHogqlString(eventName);
  return `
SELECT toDate(timestamp) AS day, count() AS count
FROM events
WHERE event = '${event}'
  AND distinct_id = '${id}'
  AND timestamp >= now() - INTERVAL ${days} DAY
GROUP BY day
ORDER BY day
`.trim();
}

function matchScoreSql(userId: string, days: number): string {
  const id = escapeHogqlString(userId);
  return `
SELECT properties.matchScore AS score
FROM events
WHERE event = 'job_found'
  AND distinct_id = '${id}'
  AND timestamp >= now() - INTERVAL ${days} DAY
`.trim();
}

/**
 * GET /api/dashboard/charts — PostHog HogQL series for the signed-in user.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  const now = new Date();
  const config = getPostHogQueryConfig();
  if (!config) {
    console.warn(
      "[api/dashboard/charts] POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID missing; returning empty series",
    );
    return NextResponse.json({
      success: true,
      data: emptyDashboardCharts(now),
    });
  }

  try {
    const [jobsDaily, researchDaily, matchScores] = await Promise.all([
      queryHogQL(
        dailyEventSql("job_found", auth.user.id, JOBS_OVER_TIME_DAYS),
        config,
      ),
      queryHogQL(
        dailyEventSql(
          "company_researched",
          auth.user.id,
          RESEARCH_ACTIVITY_DAYS,
        ),
        config,
      ),
      queryHogQL(matchScoreSql(auth.user.id, JOBS_OVER_TIME_DAYS), config),
    ]);

    const jobsRows = rowsToObjects(jobsDaily.columns, jobsDaily.results);
    const researchRows = rowsToObjects(
      researchDaily.columns,
      researchDaily.results,
    );
    const scoreRows = rowsToObjects(matchScores.columns, matchScores.results);

    const jobsOverTime = buildDaySeries(
      JOBS_OVER_TIME_DAYS,
      countsMapFromDayRows(
        jobsRows.map((r) => ({ day: r.day, count: r.count })),
      ),
      now,
    );

    const researchActivity = buildDaySeries(
      RESEARCH_ACTIVITY_DAYS,
      countsMapFromDayRows(
        researchRows.map((r) => ({ day: r.day, count: r.count })),
      ),
      now,
    );

    const matchDistribution = bucketMatchScores(
      scoreRows.map((r) => r.score),
    );

    return NextResponse.json({
      success: true,
      data: {
        jobsOverTime,
        matchDistribution,
        researchActivity,
      },
    });
  } catch (error) {
    console.error("[api/dashboard/charts]", error);
    if (isTransientError(error)) {
      return jsonError(504, "Charts service timed out. Please try again.");
    }
    return jsonError(502, "Could not load charts. Please try again.");
  }
}
