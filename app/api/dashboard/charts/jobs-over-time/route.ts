import {
  buildJobsOverTimeFromRows,
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

type FoundAtRow = { found_at: string };

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
 * GET /api/dashboard/charts/jobs-over-time?range=7d|30d|60d|all
 * InsForge jobs grouped by found_at day.
 */
export async function GET(request: Request) {
  const auth = await requireChartAuth(request);
  if (!auth.ok) return auth.response;

  const now = new Date();
  let client;
  try {
    client = createChartDbClient(auth.accessToken);
  } catch (error) {
    return mapDbError(error, "[api/dashboard/charts/jobs-over-time] client");
  }

  const since = sinceForColumn(auth.range, now);
  let filtered = client.database
    .from("jobs")
    .select("found_at")
    .eq("user_id", auth.userId) as unknown as JobsQuery;

  if (since) {
    filtered = filtered.gte("found_at", since);
  }

  const result = await filtered
    .order("found_at", { ascending: false })
    .range(0, chartFetchLimitTo());

  if (result.error) {
    return mapDbError(
      result.error,
      "[api/dashboard/charts/jobs-over-time] jobs",
    );
  }

  const rows: FoundAtRow[] = Array.isArray(result.data)
    ? (result.data as FoundAtRow[])
    : [];

  const windowDays = chartRangeWindowDays(auth.range);
  if (rows.length === 0 && windowDays != null) {
    return jsonOk(emptyDaySeries(windowDays, now));
  }

  return jsonOk(
    buildJobsOverTimeFromRows(
      rows.map((r) => r.found_at),
      auth.range,
      now,
    ),
  );
}
