/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockCreateClient, mockChain } = vi.hoisted(() => {
  const mockChain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };

  return {
    mockRequireAuth: vi.fn(),
    mockCreateClient: vi.fn(),
    mockChain,
  };
});

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: mockCreateClient,
}));

import { GET as getJobsOverTime } from "@/app/api/dashboard/charts/jobs-over-time/route";
import { GET as getMatchDistribution } from "@/app/api/dashboard/charts/match-distribution/route";
import { GET as getResearchActivity } from "@/app/api/dashboard/charts/research-activity/route";

function authOk() {
  mockRequireAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1" },
    accessToken: "tok",
  });
}

function wireChain() {
  mockChain.select.mockReturnValue(mockChain);
  mockChain.eq.mockReturnValue(mockChain);
  mockChain.not.mockReturnValue(mockChain);
  mockChain.gte.mockReturnValue(mockChain);
  mockChain.order.mockReturnValue(mockChain);
  mockChain.range.mockResolvedValue({ data: [], error: null });

  mockCreateClient.mockReturnValue({
    database: {
      from: vi.fn(() => mockChain),
    },
  });
}

describe("dashboard chart APIs (InsForge)", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockCreateClient.mockReset();
    Object.values(mockChain).forEach((fn) => fn.mockReset());
    wireChain();
  });

  it("jobs-over-time returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });
    const res = await getJobsOverTime(
      new Request("http://localhost/api/dashboard/charts/jobs-over-time"),
    );
    expect(res.status).toBe(401);
  });

  it("jobs-over-time aggregates found_at by day for 7d", async () => {
    authOk();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    mockChain.range.mockResolvedValue({
      data: [
        { found_at: "2026-08-06T10:00:00.000Z" },
        { found_at: "2026-08-06T11:00:00.000Z" },
        { found_at: "2026-08-05T09:00:00.000Z" },
      ],
      error: null,
    });

    const res = await getJobsOverTime(
      new Request(
        "http://localhost/api/dashboard/charts/jobs-over-time?range=7d",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(7);
    expect(body.data.find((p: { day: string }) => p.day === "8/6").count).toBe(
      2,
    );
    expect(mockChain.gte).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("match-distribution buckets match_score", async () => {
    authOk();
    mockChain.range.mockResolvedValue({
      data: [
        { match_score: 85, found_at: "2026-08-01T00:00:00.000Z" },
        { match_score: 92, found_at: "2026-08-02T00:00:00.000Z" },
      ],
      error: null,
    });

    const res = await getMatchDistribution(
      new Request(
        "http://localhost/api/dashboard/charts/match-distribution?range=all",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.find((b: { range: string }) => b.range === "80-90%").count).toBe(
      1,
    );
    expect(body.data.find((b: { range: string }) => b.range === "90-100%").count).toBe(
      1,
    );
    expect(mockChain.gte).not.toHaveBeenCalled();
  });

  it("research-activity groups researched_at", async () => {
    authOk();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    mockChain.range.mockResolvedValue({
      data: [{ researched_at: "2026-08-06T11:00:00.000Z" }],
      error: null,
    });

    const res = await getResearchActivity(
      new Request(
        "http://localhost/api/dashboard/charts/research-activity?range=7d",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.find((p: { day: string }) => p.day === "8/6").count).toBe(
      1,
    );
    expect(mockChain.not).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
