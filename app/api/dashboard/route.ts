import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import {
    ACTIVITY_SOURCE_FETCH_LIMIT,
    buildActivityFeed,
    computeDashboardStats,
    DASHBOARD_JOBS_FETCH_LIMIT,
    type DashboardJobStatRow,
    type DashboardResearchActivityRow,
    type DashboardRunActivityRow,
} from "@/lib/dashboard";
import { isTransientError } from "@/lib/errors";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";

export const runtime = "nodejs";

const JOB_STAT_COLUMNS =
  "id, company, match_score, company_research, researched_at, found_at" as const;

const RUN_ACTIVITY_COLUMNS =
  "id, job_title_searched, jobs_found, completed_at, started_at" as const;

type JobDashboardDbRow = {
  id: string;
  company: string | null;
  match_score: number | null;
  company_research: unknown | null;
  researched_at: string | null;
  found_at: string;
};

type RunDashboardDbRow = {
  id: string;
  job_title_searched: string | null;
  jobs_found: number;
  completed_at: string | null;
  started_at: string;
};

function jsonError(status: number, error: string) {
  return NextResponse.json(
    { success: false, error, data: null },
    { status },
  );
}

/**
 * GET /api/dashboard — stats + recent activity for the signed-in user.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  let client;
  try {
    client = createAuthedInsforgeClient(auth.accessToken);
  } catch (error) {
    console.error("[api/dashboard] client", error);
    return jsonError(503, "Could not load dashboard. Please try again.");
  }

  const now = new Date();
  const runLimitTo = ACTIVITY_SOURCE_FETCH_LIMIT - 1;
  const jobsLimitTo = DASHBOARD_JOBS_FETCH_LIMIT - 1;

  const [jobsResult, runsResult] = await Promise.all([
    client.database
      .from("jobs")
      .select(JOB_STAT_COLUMNS)
      .eq("user_id", auth.user.id)
      .order("found_at", { ascending: false })
      .range(0, jobsLimitTo),
    client.database
      .from("agent_runs")
      .select(RUN_ACTIVITY_COLUMNS)
      .eq("user_id", auth.user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .range(0, runLimitTo),
  ]);

  if (jobsResult.error) {
    console.error("[api/dashboard] jobs", jobsResult.error);
    if (isTransientError(jobsResult.error)) {
      return jsonError(504, "Dashboard service timed out. Please try again.");
    }
    return jsonError(502, "Could not load dashboard. Please try again.");
  }

  if (runsResult.error) {
    console.error("[api/dashboard] runs", runsResult.error);
    if (isTransientError(runsResult.error)) {
      return jsonError(504, "Dashboard service timed out. Please try again.");
    }
    return jsonError(502, "Could not load dashboard. Please try again.");
  }

  const jobRows: JobDashboardDbRow[] = Array.isArray(jobsResult.data)
    ? (jobsResult.data as JobDashboardDbRow[])
    : [];
  const runRows: RunDashboardDbRow[] = Array.isArray(runsResult.data)
    ? (runsResult.data as RunDashboardDbRow[])
    : [];

  const statRows: DashboardJobStatRow[] = jobRows.map((row) => ({
    match_score: row.match_score,
    company_research: row.company_research,
    found_at: row.found_at,
  }));

  const researched: DashboardResearchActivityRow[] = jobRows
    .filter((row) => row.company_research != null)
    .map((row) => ({
      id: row.id,
      company: row.company,
      researched_at: row.researched_at,
    }));

  const runs: DashboardRunActivityRow[] = runRows.map((row) => ({
    id: row.id,
    job_title_searched: row.job_title_searched,
    jobs_found:
      typeof row.jobs_found === "number" && Number.isFinite(row.jobs_found)
        ? row.jobs_found
        : 0,
    completed_at: row.completed_at,
    started_at: row.started_at,
  }));

  return NextResponse.json({
    success: true,
    data: {
      stats: computeDashboardStats(statRows, now),
      activity: buildActivityFeed(runs, researched, now),
    },
  });
}
