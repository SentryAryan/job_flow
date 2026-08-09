/**
 * Shared helpers for split dashboard chart API routes (InsForge).
 */

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { DASHBOARD_JOBS_FETCH_LIMIT } from "@/lib/dashboard";
import {
  chartRangeSinceIso,
  parseDashboardChartRange,
  type DashboardChartRange,
} from "@/lib/dashboard-range";
import { isTransientError } from "@/lib/errors";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";

export function jsonError(status: number, error: string) {
  return NextResponse.json(
    { success: false, error, data: null },
    { status },
  );
}

export function jsonOk<T>(data: T) {
  return NextResponse.json({ success: true, data, error: null });
}

export type ChartAuth =
  | { ok: true; userId: string; accessToken: string; range: DashboardChartRange }
  | { ok: false; response: NextResponse };

export async function requireChartAuth(request: Request): Promise<ChartAuth> {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return {
      ok: false,
      response: jsonError(auth.status, auth.error),
    };
  }

  const url = new URL(request.url);
  const range = parseDashboardChartRange(url.searchParams.get("range"));

  return {
    ok: true,
    userId: auth.user.id,
    accessToken: auth.accessToken,
    range,
  };
}

export function createChartDbClient(accessToken: string) {
  return createAuthedInsforgeClient(accessToken);
}

export function chartFetchLimitTo(): number {
  return DASHBOARD_JOBS_FETCH_LIMIT - 1;
}

export function sinceForColumn(
  range: DashboardChartRange,
  now: Date,
): string | null {
  return chartRangeSinceIso(range, now);
}

export function mapDbError(error: unknown, logLabel: string): NextResponse {
  console.error(logLabel, error);
  if (isTransientError(error)) {
    return jsonError(504, "Charts service timed out. Please try again.");
  }
  return jsonError(502, "Could not load charts. Please try again.");
}
