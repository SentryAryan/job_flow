/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockCreateClient, mockSelectChain, mockSelect } =
  vi.hoisted(() => {
    const mockSelectChain = {
      eq: vi.fn(),
      or: vi.fn(),
      gte: vi.fn(),
      lt: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    mockSelectChain.eq.mockReturnValue(mockSelectChain);
    mockSelectChain.or.mockReturnValue(mockSelectChain);
    mockSelectChain.gte.mockReturnValue(mockSelectChain);
    mockSelectChain.lt.mockReturnValue(mockSelectChain);
    mockSelectChain.order.mockReturnValue(mockSelectChain);
    mockSelectChain.range.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const mockSelect = vi.fn(() => mockSelectChain);

    return {
      mockRequireAuth: vi.fn(),
      mockCreateClient: vi.fn(),
      mockSelectChain,
      mockSelect,
    };
  });

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: mockCreateClient,
}));

import { GET } from "@/app/api/jobs/route";

const sampleRows = [
  {
    id: "1",
    company: "Stripe",
    title: "Frontend Engineer",
    match_score: 94,
    salary: "$160k",
    found_at: "2026-07-26T12:00:00.000Z",
  },
  {
    id: "2",
    company: "Acme",
    title: "React Developer",
    match_score: 65,
    salary: "$120k",
    found_at: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "3",
    company: "Linear",
    title: "Product Engineer",
    match_score: 85,
    salary: "$150k",
    found_at: "2026-07-24T12:00:00.000Z",
  },
];

const highRows = [sampleRows[0]!, sampleRows[2]!];

function authOk() {
  mockRequireAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1" },
    accessToken: "tok",
  });
}

describe("GET /api/jobs", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockCreateClient.mockReset();
    mockSelect.mockClear();
    mockSelectChain.eq.mockReset();
    mockSelectChain.or.mockReset();
    mockSelectChain.gte.mockReset();
    mockSelectChain.lt.mockReset();
    mockSelectChain.order.mockReset();
    mockSelectChain.range.mockReset();
    mockSelectChain.eq.mockReturnValue(mockSelectChain);
    mockSelectChain.or.mockReturnValue(mockSelectChain);
    mockSelectChain.gte.mockReturnValue(mockSelectChain);
    mockSelectChain.lt.mockReturnValue(mockSelectChain);
    mockSelectChain.order.mockReturnValue(mockSelectChain);
    mockSelectChain.range.mockResolvedValue({
      data: sampleRows,
      error: null,
      count: 3,
    });
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

    const res = await GET(new Request("http://localhost/api/jobs"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 503 when auth is transiently unavailable", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 503,
      error: "Authentication service timed out. Please try again.",
    });

    const res = await GET(new Request("http://localhost/api/jobs"));
    expect(res.status).toBe(503);
  });

  it("returns paginated jobs with default pageSize 20 via range + exact count", async () => {
    authOk();

    const res = await GET(
      new Request("http://localhost/api/jobs", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.pageSize).toBe(20);
    expect(body.data.total).toBe(3);
    expect(body.data.items).toHaveLength(3);
    expect(body.data.items[0].match_score).toBe(94);
    expect(mockSelect).toHaveBeenCalledWith(
      "id, company, title, match_score, salary, found_at",
      { count: "exact" },
    );
    expect(mockSelectChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockSelectChain.range).toHaveBeenCalledWith(0, 19);
  });

  it("does not call .limit(500)", async () => {
    authOk();
    const limitSpy = vi.fn().mockReturnValue(mockSelectChain);
    Object.assign(mockSelectChain, { limit: limitSpy });

    await GET(
      new Request("http://localhost/api/jobs", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    expect(limitSpy).not.toHaveBeenCalled();
  });

  it("respects pageSize=10 and match=high with gte", async () => {
    authOk();
    mockSelectChain.range.mockResolvedValue({
      data: highRows,
      error: null,
      count: 2,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/jobs?pageSize=10&match=high&sort=match_score",
        { headers: { Authorization: "Bearer tok" } },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pageSize).toBe(10);
    expect(body.data.total).toBe(2);
    expect(body.data.items.map((j: { id: string }) => j.id)).toEqual([
      "1",
      "3",
    ]);
    expect(mockSelectChain.gte).toHaveBeenCalledWith("match_score", 70);
    expect(mockSelectChain.range).toHaveBeenCalledWith(0, 9);
    expect(mockSelectChain.order).toHaveBeenCalledWith("match_score", {
      ascending: false,
    });
    expect(mockSelectChain.order).toHaveBeenCalledWith("found_at", {
      ascending: false,
    });
  });

  it("falls back invalid pageSize to 20", async () => {
    authOk();

    const res = await GET(
      new Request("http://localhost/api/jobs?pageSize=25", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    const body = await res.json();
    expect(body.data.pageSize).toBe(20);
    expect(mockSelectChain.range).toHaveBeenCalledWith(0, 19);
  });

  it("applies or filter for q on company and title", async () => {
    authOk();
    mockSelectChain.range.mockResolvedValue({
      data: [sampleRows[0]!],
      error: null,
      count: 1,
    });

    const res = await GET(
      new Request("http://localhost/api/jobs?q=stripe", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    const body = await res.json();
    expect(body.data.total).toBe(1);
    expect(body.data.items[0].company).toBe("Stripe");
    expect(mockSelectChain.or).toHaveBeenCalledWith(
      "company.ilike.%stripe%,title.ilike.%stripe%",
    );
  });

  it("clamps past-end page with one re-query", async () => {
    authOk();
    mockSelectChain.range
      .mockResolvedValueOnce({
        data: [],
        error: null,
        count: 3,
      })
      .mockResolvedValueOnce({
        data: sampleRows,
        error: null,
        count: 3,
      });

    const res = await GET(
      new Request("http://localhost/api/jobs?page=99&pageSize=10", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    const body = await res.json();
    expect(body.data.page).toBe(1);
    expect(body.data.totalPages).toBe(1);
    expect(body.data.total).toBe(3);
    expect(mockSelectChain.range).toHaveBeenCalledTimes(2);
    expect(mockSelectChain.range).toHaveBeenNthCalledWith(1, 980, 989);
    expect(mockSelectChain.range).toHaveBeenNthCalledWith(2, 0, 9);
  });

  it("returns 504 when InsForge select times out", async () => {
    authOk();
    mockSelectChain.range.mockResolvedValue({
      data: null,
      error: { message: "InsForgeError: Request timed out after 30000ms" },
      count: null,
    });

    const res = await GET(
      new Request("http://localhost/api/jobs", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/timed out/i);
  });
});
