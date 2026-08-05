/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockCreateClient, mockMaybeSingle, mockEqId, mockEqUser, mockSelect } =
  vi.hoisted(() => {
    const mockMaybeSingle = vi.fn();
    const mockEqId = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockEqUser = vi.fn(() => ({ eq: mockEqId }));
    const mockSelect = vi.fn(() => ({ eq: mockEqUser }));

    return {
      mockRequireAuth: vi.fn(),
      mockCreateClient: vi.fn(),
      mockMaybeSingle,
      mockEqId,
      mockEqUser,
      mockSelect,
    };
  });

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: mockCreateClient,
}));

import { GET } from "@/app/api/jobs/[id]/route";

const sampleRow = {
  id: "job-1",
  run_id: "run-1",
  user_id: "user-1",
  source: "search",
  source_url: "https://adzuna.example/job",
  external_apply_url: "https://employer.example/apply",
  title: "Backend Developer",
  company: "Insight Global",
  location: "Newark, Essex",
  salary: "$101k – $101k",
  job_type: "fulltime",
  about_role: "Build APIs",
  responsibilities: [],
  requirements: [],
  nice_to_have: [],
  benefits: [],
  about_company: null,
  match_score: 85,
  match_reason: "Strong Node.js match",
  matched_skills: ["Node.js"],
  missing_skills: ["Java"],
  company_research: null,
  found_at: "2026-08-02T10:00:00.000Z",
};

function authOk() {
  mockRequireAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1" },
    accessToken: "tok",
  });
}

describe("GET /api/jobs/[id]", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockCreateClient.mockReset();
    mockSelect.mockClear();
    mockEqUser.mockClear();
    mockEqId.mockClear();
    mockMaybeSingle.mockReset();
    mockEqId.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockEqUser.mockReturnValue({ eq: mockEqId });
    mockSelect.mockReturnValue({ eq: mockEqUser });
    mockCreateClient.mockReturnValue({
      database: {
        from: vi.fn(() => ({
          select: mockSelect,
        })),
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });

    const res = await GET(new Request("http://localhost/api/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 for empty id", async () => {
    authOk();
    const res = await GET(new Request("http://localhost/api/jobs/ "), {
      params: Promise.resolve({ id: "  " }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when job is missing", async () => {
    authOk();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await GET(new Request("http://localhost/api/jobs/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 with mapped job on success", async () => {
    authOk();
    mockMaybeSingle.mockResolvedValue({ data: sampleRow, error: null });

    const res = await GET(new Request("http://localhost/api/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("job-1");
    expect(body.data.match_score).toBe(85);
    expect(body.data.matched_skills).toEqual(["Node.js"]);
    expect(mockEqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockEqId).toHaveBeenCalledWith("id", "job-1");
  });

  it("returns 504 on transient DB errors", async () => {
    authOk();
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "timeout", name: "TimeoutError" },
    });

    const res = await GET(new Request("http://localhost/api/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    expect(res.status).toBe(504);
  });
});
