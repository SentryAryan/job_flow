import {
  buildMatchDistributionFromScores,
  emptyMatchDistribution,
} from "@/lib/dashboard-charts";
import {
  chartFetchLimitTo,
  createChartDbClient,
  jsonOk,
  mapDbError,
  requireChartAuth,
  sinceForColumn,
} from "@/lib/dashboard-charts-api";

export const runtime = "nodejs";

type MatchRow = {
  match_score: number | null;
  found_at: string;
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
 * GET /api/dashboard/charts/match-distribution?range=7d|30d|60d|all
 * InsForge jobs.match_score histogram (filtered by found_at).
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
      "[api/dashboard/charts/match-distribution] client",
    );
  }

  const since = sinceForColumn(auth.range, now);
  let filtered = client.database
    .from("jobs")
    .select("match_score, found_at")
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
      "[api/dashboard/charts/match-distribution] jobs",
    );
  }

  const rows: MatchRow[] = Array.isArray(result.data)
    ? (result.data as MatchRow[])
    : [];

  if (rows.length === 0) {
    return jsonOk(emptyMatchDistribution());
  }

  return jsonOk(
    buildMatchDistributionFromScores(rows.map((r) => r.match_score)),
  );
}
