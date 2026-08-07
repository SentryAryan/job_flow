/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockGetConfig, mockQueryHogQL } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetConfig: vi.fn(),
  mockQueryHogQL: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/posthog-query", async () => {
  const actual = await vi.importActual<typeof import("@/lib/posthog-query")>(
    "@/lib/posthog-query",
  );
  return {
    ...actual,
    getPostHogQueryConfig: mockGetConfig,
    queryHogQL: mockQueryHogQL,
  };
});

import { GET } from "@/app/api/dashboard/charts/route";

function authOk() {
  mockRequireAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1" },
    accessToken: "tok",
  });
}

describe("GET /api/dashboard/charts", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockGetConfig.mockReset();
    mockQueryHogQL.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });

    const res = await GET(new Request("http://localhost/api/dashboard/charts"));
    expect(res.status).toBe(401);
  });

  it("returns empty zero-filled series when PostHog query config is missing", async () => {
    authOk();
    mockGetConfig.mockReturnValue(null);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));

    const res = await GET(new Request("http://localhost/api/dashboard/charts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.jobsOverTime).toHaveLength(30);
    expect(body.data.researchActivity).toHaveLength(7);
    expect(body.data.matchDistribution).toHaveLength(5);
    expect(body.data.jobsOverTime.every((p: { count: number }) => p.count === 0)).toBe(
      true,
    );
    expect(mockQueryHogQL).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("maps HogQL rows into chart series", async () => {
    authOk();
    mockGetConfig.mockReturnValue({
      personalApiKey: "phx_test",
      projectId: "471373",
      apiHost: "https://us.posthog.com",
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));

    mockQueryHogQL
      .mockResolvedValueOnce({
        columns: ["day", "count"],
        results: [["2026-08-06", 5], ["2026-08-05", 2]],
      })
      .mockResolvedValueOnce({
        columns: ["day", "count"],
        results: [["2026-08-06", 1]],
      })
      .mockResolvedValueOnce({
        columns: ["score"],
        results: [["85"], ["92"], ["40"]],
      });

    const res = await GET(new Request("http://localhost/api/dashboard/charts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.jobsOverTime.at(-1)).toEqual({ day: "8/6", count: 5 });
    expect(body.data.jobsOverTime.at(-2)).toEqual({ day: "8/5", count: 2 });
    expect(body.data.researchActivity.at(-1)).toEqual({ day: "8/6", count: 1 });
    expect(
      body.data.matchDistribution.find(
        (b: { range: string }) => b.range === "80-90%",
      ).count,
    ).toBe(1);
    expect(
      body.data.matchDistribution.find(
        (b: { range: string }) => b.range === "90-100%",
      ).count,
    ).toBe(1);

    vi.useRealTimers();
  });

  it("returns 504 on transient PostHog errors", async () => {
    authOk();
    mockGetConfig.mockReturnValue({
      personalApiKey: "phx_test",
      projectId: "471373",
      apiHost: "https://us.posthog.com",
    });
    mockQueryHogQL.mockRejectedValue(new Error("PostHog query timed out"));

    const res = await GET(new Request("http://localhost/api/dashboard/charts"));
    expect(res.status).toBe(504);
  });

  it("returns 502 on non-transient PostHog errors", async () => {
    authOk();
    mockGetConfig.mockReturnValue({
      personalApiKey: "phx_test",
      projectId: "471373",
      apiHost: "https://us.posthog.com",
    });
    mockQueryHogQL.mockRejectedValue(new Error("permission denied"));

    const res = await GET(new Request("http://localhost/api/dashboard/charts"));
    expect(res.status).toBe(502);
  });
});
