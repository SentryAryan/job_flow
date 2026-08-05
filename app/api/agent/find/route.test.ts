/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuth,
  mockCreateClient,
  mockDiscoverJobs,
  mockCanUseQuota,
  mockEnforceRateLimit,
  mockEnforceIpRateLimit,
  mockLoadByokKeys,
  mockMapRowToProfile,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockCreateClient: vi.fn(),
  mockDiscoverJobs: vi.fn(),
  mockCanUseQuota: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockEnforceIpRateLimit: vi.fn(async () => ({ enforced: false as const })),
  mockLoadByokKeys: vi.fn(async () => [] as string[]),
  mockMapRowToProfile: vi.fn((row: Record<string, unknown>) => row),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: mockCreateClient,
}));

vi.mock("@/agent/adzuna", () => ({
  discoverJobs: mockDiscoverJobs,
}));

vi.mock("@/lib/byok-keys", () => ({
  BYOK_KEYS_FAILED_USER_MESSAGE:
    "Your OpenRouter keys could not be used. Update or remove them on Profile.",
  loadDecryptedOpenRouterKeys: mockLoadByokKeys,
}));

vi.mock("@/lib/profile", () => ({
  mapRowToProfile: mockMapRowToProfile,
}));

vi.mock("@/lib/resume-ai-rate-limit", () => ({
  canUseResumeAiQuota: mockCanUseQuota,
  enforceResumeAiRateLimit: mockEnforceRateLimit,
  enforceResumeAiIpRateLimit: mockEnforceIpRateLimit,
  rateLimitHeadersFromUsage: () => ({
    "X-RateLimit-Limit": "3",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "999",
    "Retry-After": "60",
  }),
  rateLimitResponseHeaders: (result: {
    limit: number;
    remaining: number;
    resetAt: number;
  }) => ({
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": "60",
  }),
}));

import { POST } from "@/app/api/agent/find/route";

function authOk() {
  mockRequireAuth.mockResolvedValue({
    success: true,
    user: { id: "user-1", email: "a@b.com" },
    accessToken: "token",
  });
}

function profileClientOk() {
  mockCreateClient.mockReturnValue({
    database: {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return {
                      data: { id: "user-1", full_name: "Ada" },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  });
}

async function postFind(body: unknown) {
  return POST(
    new Request("http://localhost/api/agent/find", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/agent/find", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    profileClientOk();
    mockLoadByokKeys.mockResolvedValue([]);
    mockCanUseQuota.mockResolvedValue({
      checked: false,
      allowed: true,
    });
    mockEnforceRateLimit.mockResolvedValue({ enforced: false });
    mockEnforceIpRateLimit.mockResolvedValue({ enforced: false });
    mockDiscoverJobs.mockResolvedValue({
      success: true,
      jobsFound: 2,
      strongMatches: 1,
      runId: "run-1",
      message: "Found and saved 2 jobs · 1 strong match (70%+).",
      matchScores: [92, 60],
    });
    process.env.APP_ENV = "development";
  });

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await postFind({ jobTitle: "Engineer" });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
      data: null,
    });
    expect(mockDiscoverJobs).not.toHaveBeenCalled();
  });

  it("returns 404 when profile is missing", async () => {
    mockCreateClient.mockReturnValue({
      database: {
        from() {
          return {
            select() {
              return {
                eq() {
                  return {
                    async single() {
                      return { data: null, error: { message: "not found" } };
                    },
                  };
                },
              };
            },
          };
        },
      },
    });

    const response = await postFind({ jobTitle: "Engineer" });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Profile not found. Save your profile and try again.",
      data: null,
    });
  });

  it("returns 429 when admission quota is exhausted", async () => {
    mockCanUseQuota.mockResolvedValue({
      checked: true,
      allowed: false,
      windows: [
        {
          name: "minute",
          allowed: false,
          limit: 3,
          remaining: 0,
          resetAt: Date.now() + 60_000,
        },
      ],
    });

    const response = await postFind({ jobTitle: "Engineer" });
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Too many AI requests. Please try again later.",
    });
    expect(mockDiscoverJobs).not.toHaveBeenCalled();
  });

  it("returns 429 when IP rate limit is exceeded before discovery", async () => {
    mockEnforceIpRateLimit.mockResolvedValue({
      enforced: true,
      result: {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 60_000,
        blockedBy: "1m",
      },
    });

    const response = await postFind({ jobTitle: "Engineer" });
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Too many requests from this network. Please try again later.",
    });
    expect(mockCanUseQuota).not.toHaveBeenCalled();
    expect(mockDiscoverJobs).not.toHaveBeenCalled();
  });

  it("skips rate-limit admission when BYOK keys exist", async () => {
    mockLoadByokKeys.mockResolvedValue(["sk-or-v1-test"]);

    const response = await postFind({
      jobTitle: "Engineer",
      location: "Remote",
    });
    expect(response.status).toBe(200);
    expect(mockCanUseQuota).not.toHaveBeenCalled();
    expect(mockDiscoverJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        openRouter: { keys: ["sk-or-v1-test"] },
        scoreRateLimit: undefined,
      }),
    );
  });

  it("returns discovery result on success", async () => {
    const response = await postFind({
      jobTitle: "Frontend Engineer",
      location: "San Francisco, CA",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        jobsFound: 2,
        strongMatches: 1,
        runId: "run-1",
        message: "Found and saved 2 jobs · 1 strong match (70%+).",
        matchScores: [92, 60],
      },
    });
    expect(mockDiscoverJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: "Frontend Engineer",
        location: "San Francisco, CA",
        userId: "user-1",
      }),
    );
  });

  it("returns 400 when job title is missing", async () => {
    const response = await postFind({ location: "Remote" });
    expect(response.status).toBe(400);
    expect(mockDiscoverJobs).not.toHaveBeenCalled();
  });
});
