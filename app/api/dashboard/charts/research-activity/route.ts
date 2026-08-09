import {
    buildResearchActivityFromRows,
    emptyDaySeries,
} from "@/lib/dashboard-charts";
import {
    chartFetchLimitTo,
    createChartDbClient,
    jsonOk,
    mapDbError,
    requireChartAuth,
    sinceForColumn,
} from "@/lib/dashboard-charts-api";
import { chartRangeWindowDays } from "@/lib/dashboard-range";

export const runtime = "nodejs";

type ResearchRow = {
  researched_at: string | null;
};

type JobsQuery = {
  gte: (column: string, value: string) => JobsQuery;
  order: (
    column: string,
    opts: { ascending: boolean },
  ) => {
    range: (
      from: number,
      to: number,
    ) => Promise<{ data: unknown; error: unknown }>;
  };
};

/**
 * GET /api/dashboard/charts/research-activity?range=7d|30d|60d|all
 * Jobs with company research, grouped by researched_at day.
 */
export async function GET(request: Request) {
  const auth = await requireChartAuth(request);
  if (!auth.ok) return auth.response;

  const now = new Date();
  let client;
  try {
    client = createChartDbClient(auth.accessToken);
  } catch (error) {
    return mapDbError(
      error,
      "[api/dashboard/charts/research-activity] client",
    );
  }

  const since = sinceForColumn(auth.range, now);
  let filtered = client.database
    .from("jobs")
    .select("researched_at")
    .eq("user_id", auth.userId)
    .not("researched_at", "is", null) as unknown as JobsQuery;

  if (since) {
    filtered = filtered.gte("researched_at", since);
  }

  const result = await filtered
    .order("researched_at", { ascending: false })
    .range(0, chartFetchLimitTo());

  if (result.error) {
    return mapDbError(
      result.error,
      "[api/dashboard/charts/research-activity] jobs",
    );
  }

  const rows: ResearchRow[] = Array.isArray(result.data)
    ? (result.data as ResearchRow[])
    : [];

  const windowDays = chartRangeWindowDays(auth.range);
  if (rows.length === 0 && windowDays != null) {
    return jsonOk(emptyDaySeries(windowDays, now));
  }

  return jsonOk(
    buildResearchActivityFromRows(
      rows.map((r) => r.researched_at),
      auth.range,
      now,
    ),
  );
}
