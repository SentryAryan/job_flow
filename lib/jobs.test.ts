/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authed-fetch", () => ({
  authedFetch: vi.fn(),
}));

import { authedFetch } from "@/lib/authed-fetch";
import { fetchJobById } from "@/lib/jobs";

const sampleJob = {
  id: "job-1",
  run_id: null,
  user_id: "user-1",
  source: "search" as const,
  source_url: "https://example.com",
  external_apply_url: "https://example.com/apply",
  title: "Backend Developer",
  company: "Insight Global",
  location: "Newark",
  salary: "$101k",
  job_type: "fulltime",
  about_role: "Build APIs",
  responsibilities: [],
  requirements: [],
  nice_to_have: [],
  benefits: [],
  about_company: null,
  match_score: 85,
  match_reason: "Good match",
  matched_skills: ["Node.js"],
  missing_skills: [],
  company_research: null,
  found_at: "2026-08-02T10:00:00.000Z",
};

describe("fetchJobById", () => {
  beforeEach(() => {
    vi.mocked(authedFetch).mockReset();
  });

  it("returns error for empty id without fetching", async () => {
    const result = await fetchJobById("  ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(400);
    }
    expect(authedFetch).not.toHaveBeenCalled();
  });

  it("returns job on success", async () => {
    vi.mocked(authedFetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: sampleJob }), {
        status: 200,
      }),
    );

    const result = await fetchJobById("job-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("job-1");
    }
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/jobs/job-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("maps 404 to not found", async () => {
    vi.mocked(authedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: "Job not found.", data: null }),
        { status: 404 },
      ),
    );

    const result = await fetchJobById("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(404);
      expect(result.error).toMatch(/not found/i);
    }
  });

  it("handles network failures", async () => {
    vi.mocked(authedFetch).mockRejectedValue(new Error("offline"));
    const result = await fetchJobById("job-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/try again/i);
    }
  });
});
