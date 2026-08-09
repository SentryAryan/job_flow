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

import { GET } from "@/app/api/dashboard/insights/route";

function authOk() {
  mockRequireAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1" },
    accessToken: "tok",
  });
}

describe("GET /api/dashboard/insights", () => {
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
    const res = await GET(
      new Request("http://localhost/api/dashboard/insights"),
    );
    expect(res.status).toBe(401);
  });

  it("returns empty series when PostHog config is missing", async () => {
    authOk();
    mockGetConfig.mockReturnValue(null);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));

    const res = await GET(
      new Request("http://localhost/api/dashboard/insights?range=7d"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.jobSearchesOverTime).toHaveLength(7);
    expect(body.data.featureUsage).toHaveLength(3);
    expect(mockQueryHogQL).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("maps HogQL searches and feature counts", async () => {
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
        results: [["2026-08-06", 2]],
      })
      .mockResolvedValueOnce({ columns: ["count"], results: [[3]] })
      .mockResolvedValueOnce({ columns: ["count"], results: [[1]] })
      .mockResolvedValueOnce({ columns: ["count"], results: [[0]] });

    const res = await GET(
      new Request("http://localhost/api/dashboard/insights?range=7d"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(
      body.data.jobSearchesOverTime.find(
        (p: { day: string }) => p.day === "8/6",
      ).count,
    ).toBe(2);
    expect(body.data.featureUsage[0].count).toBe(3);
    expect(body.data.featureUsage[1].count).toBe(1);
    expect(mockQueryHogQL).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });
});
