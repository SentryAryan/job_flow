import { describe, expect, it, vi } from "vitest";

import { findJobs } from "@/lib/find-jobs-api";
import { jobToListRow } from "@/lib/find-jobs-list";

vi.mock("@/lib/authed-fetch", () => ({
  authedFetch: vi.fn(),
}));

import { authedFetch } from "@/lib/authed-fetch";

describe("jobToListRow", () => {
  it("normalizes null fields for the table", () => {
    expect(
      jobToListRow({
        id: "1",
        company: null,
        title: null,
        match_score: null,
        salary: null,
        found_at: "2026-07-01T00:00:00Z",
      }),
    ).toEqual({
      id: "1",
      company: "Unknown company",
      title: "Untitled role",
      match_score: 0,
      salary: "—",
      found_at: "2026-07-01T00:00:00Z",
    });
  });
});

describe("findJobs", () => {
  it("returns success payload from /api/agent/find", async () => {
    vi.mocked(authedFetch).mockResolvedValue(
      Response.json({
        success: true,
        data: {
          jobsFound: 2,
          strongMatches: 1,
          runId: "run-1",
          message: "Found and saved 2 jobs · 1 strong match (70%+).",
          matchScores: [90, 40],
        },
      }),
    );

    const result = await findJobs("Engineer", "Remote");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.jobsFound).toBe(2);
    expect(result.data.matchScores).toEqual([90, 40]);
  });

  it("surfaces API errors", async () => {
    vi.mocked(authedFetch).mockResolvedValue(
      Response.json(
        { success: false, error: "Too many AI requests. Please try again later." },
        { status: 429 },
      ),
    );

    const result = await findJobs("Engineer", "");
    expect(result).toEqual({
      success: false,
      status: 429,
      error: "Too many AI requests. Please try again later.",
    });
  });
});
