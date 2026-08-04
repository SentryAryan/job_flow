import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { isTransientError } from "@/lib/errors";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import { mapDbRowToJob, type JobDbRow } from "@/lib/job-detail";

export const runtime = "nodejs";

const JOB_DETAIL_COLUMNS = [
  "id",
  "run_id",
  "user_id",
  "source",
  "source_url",
  "external_apply_url",
  "title",
  "company",
  "location",
  "salary",
  "job_type",
  "about_role",
  "responsibilities",
  "requirements",
  "nice_to_have",
  "benefits",
  "about_company",
  "match_score",
  "match_reason",
  "matched_skills",
  "missing_skills",
  "company_research",
  "found_at",
].join(", ");

function jsonError(status: number, error: string) {
  return NextResponse.json(
    { success: false, error, data: null },
    { status },
  );
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/jobs/[id] — full job row for the signed-in owner.
 * Missing / non-owned rows return 404 (RLS + explicit not-found).
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  const { id: rawId } = await context.params;
  const id = rawId?.trim() ?? "";
  if (!id) {
    return jsonError(400, "Job id is required.");
  }

  let client;
  try {
    client = createAuthedInsforgeClient(auth.accessToken);
  } catch (error) {
    console.error("[api/jobs/id] client", error);
    return jsonError(503, "Could not load job. Please try again.");
  }

  const { data, error } = await client.database
    .from("jobs")
    .select(JOB_DETAIL_COLUMNS)
    .eq("user_id", auth.user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[api/jobs/id] select", error);
    if (isTransientError(error)) {
      return jsonError(504, "Jobs service timed out. Please try again.");
    }
    return jsonError(502, "Could not load job. Please try again.");
  }

  if (!data) {
    return jsonError(404, "Job not found.");
  }

  const job = mapDbRowToJob(data as unknown as JobDbRow);

  return NextResponse.json({
    success: true,
    data: job,
    error: null,
  });
}
