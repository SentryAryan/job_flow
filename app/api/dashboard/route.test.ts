/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuth,
  mockCreateClient,
  mockJobsFrom,
  mockRunsFrom,
  mockJobsSelect,
  mockRunsSelect,
  mockJobsEq,
  mockJobsOrder,
  mockJobsRange,
  mockRunsEqUser,
  mockRunsEqStatus,
  mockRunsOrder,
  mockRunsRange,
} = vi.hoisted(() => {
  const mockJobsRange = vi.fn();
  const mockJobsOrder = vi.fn(() => ({ range: mockJobsRange }));
  const mockJobsEq = vi.fn(() => ({ order: mockJobsOrder }));
  const mockJobsSelect = vi.fn(() => ({ eq: mockJobsEq }));
  const mockJobsFrom = vi.fn(() => ({ select: mockJobsSelect }));

  const mockRunsRange = vi.fn();
  const mockRunsOrder = vi.fn(() => ({ range: mockRunsRange }));
  const mockRunsEqStatus = vi.fn(() => ({ order: mockRunsOrder }));
  const mockRunsEqUser = vi.fn(() => ({ eq: mockRunsEqStatus }));
  const mockRunsSelect = vi.fn(() => ({ eq: mockRunsEqUser }));
  const mockRunsFrom = vi.fn(() => ({ select: mockRunsSelect }));

  return {
    mockRequireAuth: vi.fn(),
    mockCreateClient: vi.fn(),
    mockJobsFrom,
    mockRunsFrom,
    mockJobsSelect,
    mockRunsSelect,
    mockJobsEq,
    mockJobsOrder,
    mockJobsRange,
    mockRunsEqUser,
    mockRunsEqStatus,
    mockRunsOrder,
    mockRunsRange,
  };
});

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: mockCreateClient,
}));

import { GET } from "@/app/api/dashboard/route";

function authOk() {
  mockRequireAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1" },
    accessToken: "tok",
  });
}

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockCreateClient.mockReset();
    mockJobsFrom.mockClear();
    mockRunsFrom.mockClear();
    mockJobsSelect.mockClear();
    mockRunsSelect.mockClear();
    mockJobsEq.mockReset();
    mockJobsOrder.mockReset();
    mockJobsRange.mockReset();
    mockRunsEqUser.mockReset();
    mockRunsEqStatus.mockReset();
    mockRunsOrder.mockReset();
    mockRunsRange.mockReset();

    mockJobsOrder.mockReturnValue({ range: mockJobsRange });
    mockJobsEq.mockReturnValue({ order: mockJobsOrder });
    mockJobsSelect.mockReturnValue({ eq: mockJobsEq });
    mockJobsFrom.mockReturnValue({ select: mockJobsSelect });
    mockRunsOrder.mockReturnValue({ range: mockRunsRange });
    mockRunsEqStatus.mockReturnValue({ order: mockRunsOrder });
    mockRunsEqUser.mockReturnValue({ eq: mockRunsEqStatus });
    mockRunsSelect.mockReturnValue({ eq: mockRunsEqUser });
    mockRunsFrom.mockReturnValue({ select: mockRunsSelect });

    mockCreateClient.mockReturnValue({
      database: {
        from: vi.fn((table: string) => {
          if (table === "jobs") return mockJobsFrom();
          if (table === "agent_runs") return mockRunsFrom();
          throw new Error(`unexpected table ${table}`);
        }),
      },
    });

    mockJobsRange.mockResolvedValue({
      data: [
        {
          id: "job-1",
          company: "Stripe",
          match_score: 90,
          company_research: { companyOverview: "x" },
          researched_at: "2026-08-06T11:00:00.000Z",
          found_at: "2026-08-05T10:00:00.000Z",
        },
        {
          id: "job-2",
          company: "Acme",
          match_score: 80,
          company_research: null,
          researched_at: null,
          found_at: "2026-07-01T10:00:00.000Z",
        },
      ],
      error: null,
    });

    mockRunsRange.mockResolvedValue({
      data: [
        {
          id: "run-1",
          job_title_searched: "Frontend Engineer",
          jobs_found: 8,
          completed_at: "2026-08-06T11:50:00.000Z",
          started_at: "2026-08-06T11:40:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns stats and activity for the user", async () => {
    authOk();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.stats.totalJobsFound.value).toBe(2);
    expect(body.data.stats.avgMatchRate.value).toBe(85);
    expect(body.data.stats.companiesResearched.value).toBe(1);
    expect(body.data.stats.jobsThisWeek.value).toBe(1);
    expect(body.data.activity[0]).toMatchObject({
      type: "job_found",
      message: "Found 8 jobs for Frontend Engineer",
    });
    expect(body.data.activity[1]).toMatchObject({
      type: "company_researched",
      message: "Researched Stripe",
    });

    expect(mockJobsEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockJobsOrder).toHaveBeenCalledWith("found_at", {
      ascending: false,
    });
    expect(mockJobsRange).toHaveBeenCalledWith(0, 4999);
    expect(mockRunsEqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockRunsEqStatus).toHaveBeenCalledWith("status", "completed");
    expect(mockRunsOrder).toHaveBeenCalledWith("completed_at", {
      ascending: false,
    });
    expect(mockRunsRange).toHaveBeenCalledWith(0, 9);

    vi.useRealTimers();
  });

  it("returns 504 on transient jobs errors", async () => {
    authOk();
    mockJobsRange.mockResolvedValue({
      data: null,
      error: new Error("Request timed out"),
    });

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(504);
  });

  it("returns 504 on transient agent_runs errors", async () => {
    authOk();
    mockRunsRange.mockResolvedValue({
      data: null,
      error: new Error("Request timed out"),
    });

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(504);
  });

  it("returns 502 on non-transient agent_runs errors", async () => {
    authOk();
    mockRunsRange.mockResolvedValue({
      data: null,
      error: new Error("permission denied"),
    });

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(502);
  });

  it("returns 503 when client cannot be created", async () => {
    authOk();
    mockCreateClient.mockImplementation(() => {
      throw new Error("missing config");
    });

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(503);
  });
});
