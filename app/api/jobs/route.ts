import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { isTransientError } from "@/lib/errors";
import {
    isMatchFilter,
    isSortOption,
    jobToListRow,
    parsePageSizeParam,
    type JobListRow,
} from "@/lib/find-jobs-list";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import {
    buildJobsListQueryPlan,
    paginateMeta,
    type JobsListQueryPlan,
} from "@/lib/jobs-list-query";

export const runtime = "nodejs";

const JOB_LIST_COLUMNS =
  "id, company, title, match_score, salary, found_at" as const;

type JobListDbRow = {
  id: string;
  company: string | null;
  title: string | null;
  match_score: number | null;
  salary: string | null;
  found_at: string;
};

function jsonError(status: number, error: string) {
  return NextResponse.json(
    { success: false, error, data: null },
    { status },
  );
}

type JobsQueryBuilder = {
  eq: (column: string, value: string) => JobsQueryBuilder;
  or: (filters: string) => JobsQueryBuilder;
  gte: (column: string, value: number) => JobsQueryBuilder;
  lt: (column: string, value: number) => JobsQueryBuilder;
  order: (
    column: string,
    opts: { ascending: boolean },
  ) => JobsQueryBuilder;
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: JobListDbRow[] | null;
    error: unknown;
    count: number | null;
  }>;
};

function applyJobsListFilters(
  // InsForge query builder is progressively typed; keep a narrow local surface.
  builder: JobsQueryBuilder,
  userId: string,
  plan: JobsListQueryPlan,
): JobsQueryBuilder {
  let q = builder.eq("user_id", userId);
  if (plan.orFilter) {
    q = q.or(plan.orFilter);
  }
  if (plan.matchGte != null) {
    q = q.gte("match_score", plan.matchGte);
  }
  if (plan.matchLt != null) {
    q = q.lt("match_score", plan.matchLt);
  }
  q = q.order(plan.orderColumn, { ascending: plan.ascending });
  if (plan.tieBreakFoundAtDesc) {
    q = q.order("found_at", { ascending: false });
  }
  return q;
}

/**
 * GET /api/jobs — paginated job list for the signed-in user.
 * Query: page, pageSize (10|20|50), q, match (all|high|low), sort (match_score|newest|oldest)
 *
 * Filters, sort, and pagination run in Postgres via PostgREST (exact count + range).
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
    console.error("[api/jobs] client", error);
    return jsonError(503, "Could not load jobs. Please try again.");
  }

  const url = new URL(request.url);
  const pageRaw = url.searchParams.get("page");
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const pageSize = parsePageSizeParam(url.searchParams.get("pageSize"));
  const q = url.searchParams.get("q")?.trim() ?? "";
  const matchRaw = url.searchParams.get("match") ?? "all";
  const sortRaw = url.searchParams.get("sort") ?? "match_score";
  const matchFilter = isMatchFilter(matchRaw) ? matchRaw : "all";
  const sort = isSortOption(sortRaw) ? sortRaw : "match_score";

  const plan = buildJobsListQueryPlan({
    page,
    pageSize,
    q,
    matchFilter,
    sort,
  });

  const baseSelect = client.database
    .from("jobs")
    .select(JOB_LIST_COLUMNS, { count: "exact" }) as unknown as JobsQueryBuilder;

  const { data, error, count } = await applyJobsListFilters(
    baseSelect,
    auth.user.id,
    plan,
  ).range(plan.from, plan.to);

  if (error) {
    console.error("[api/jobs] select", error);
    if (isTransientError(error)) {
      return jsonError(504, "Jobs service timed out. Please try again.");
    }
    return jsonError(502, "Could not load jobs. Please try again.");
  }

  const total = typeof count === "number" && count >= 0 ? count : 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const needsClamp = total > 0 && page > totalPages;

  let rows: JobListDbRow[] = Array.isArray(data) ? data : [];
  let safePage = page;

  if (needsClamp) {
    const clampedPlan = buildJobsListQueryPlan({
      page: totalPages,
      pageSize,
      q,
      matchFilter,
      sort,
    });
    const retrySelect = client.database
      .from("jobs")
      .select(JOB_LIST_COLUMNS, { count: "exact" }) as unknown as JobsQueryBuilder;

    const retry = await applyJobsListFilters(
      retrySelect,
      auth.user.id,
      clampedPlan,
    ).range(clampedPlan.from, clampedPlan.to);

    if (retry.error) {
      console.error("[api/jobs] select clamp", retry.error);
      if (isTransientError(retry.error)) {
        return jsonError(504, "Jobs service timed out. Please try again.");
      }
      return jsonError(502, "Could not load jobs. Please try again.");
    }

    rows = Array.isArray(retry.data) ? retry.data : [];
    safePage = totalPages;
  }

  const items: JobListRow[] = rows.map((row) => jobToListRow(row));
  const meta = paginateMeta({
    total,
    page: safePage,
    pageSize,
    itemCount: items.length,
  });

  return NextResponse.json({
    success: true,
    data: {
      items,
      page: meta.page,
      pageSize,
      total,
      totalPages: meta.totalPages,
      from: meta.from,
      to: meta.to,
    },
  });
}
