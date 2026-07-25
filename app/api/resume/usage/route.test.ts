/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockPeek, mockHasByok } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockPeek: vi.fn(),
  mockHasByok: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/resume-ai-rate-limit", () => ({
  peekResumeAiUsage: mockPeek,
}));

vi.mock("@/lib/byok-keys", () => ({
  userHasByokKeys: mockHasByok,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: vi.fn(() => ({})),
}));

import { GET } from "@/app/api/resume/usage/route";

describe("GET /api/resume/usage", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockPeek.mockReset();
    mockHasByok.mockReset();
    mockHasByok.mockResolvedValue(false);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });

    const res = await GET(new Request("http://localhost/api/resume/usage"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns usage snapshot when authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      success: true,
      user: { id: "user-1" },
      accessToken: "tok",
    });
    mockPeek.mockResolvedValue({
      available: true,
      combined: true,
      windows: [
        {
          name: "1m",
          limit: 3,
          used: 1,
          remaining: 2,
          resetAt: Date.now() + 60_000,
        },
      ],
    });

    const res = await GET(
      new Request("http://localhost/api/resume/usage", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(true);
    expect(body.data.combined).toBe(true);
    expect(body.data.windows[0].used).toBe(1);
    expect(mockPeek).toHaveBeenCalledWith("user-1", undefined, {
      hasByokKeys: false,
    });
  });

  it("passes hasByokKeys true into peek", async () => {
    mockRequireAuth.mockResolvedValue({
      success: true,
      user: { id: "user-1" },
      accessToken: "tok",
    });
    mockHasByok.mockResolvedValue(true);
    mockPeek.mockResolvedValue({
      available: false,
      combined: true,
      windows: [],
    });

    const res = await GET(
      new Request("http://localhost/api/resume/usage", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockPeek).toHaveBeenCalledWith("user-1", undefined, {
      hasByokKeys: true,
    });
  });
});
