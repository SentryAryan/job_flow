/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuth,
  mockResearchCompany,
  mockCanUseQuota,
  mockEnforceRateLimit,
  mockEnforceIpRateLimit,
  mockLoadByokKeys,
  mockCreateClient,
  mockGetOpenRouterKeys,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockResearchCompany: vi.fn(),
  mockCanUseQuota: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockEnforceIpRateLimit: vi.fn(async (): Promise<
    | { enforced: false }
    | {
        enforced: true;
        result: {
          allowed: boolean;
          limit: number;
          remaining: number;
          resetAt: number;
          blockedBy?: string;
        };
      }
  > => ({ enforced: false })),
  mockLoadByokKeys: vi.fn(async () => [] as string[]),
  mockCreateClient: vi.fn(() => ({})),
  mockGetOpenRouterKeys: vi.fn(() => ["sk-platform"]),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/agent/research", () => ({
  researchCompany: mockResearchCompany,
}));

vi.mock("@/lib/resume-ai-rate-limit", () => ({
  canUseResumeAiQuota: mockCanUseQuota,
  enforceResumeAiRateLimit: mockEnforceRateLimit,
  enforceResumeAiRateLimitHitsCapped: vi.fn(async () => ({ enforced: false, recorded: 0 })),
  enforceResumeAiIpRateLimit: mockEnforceIpRateLimit,
  minResumeAiRemaining: (windows: Array<{ remaining: number }>) =>
    windows.length === 0
      ? 0
      : Math.min(...windows.map((w) => w.remaining)),
  hasResumeAiHeadroom: (
    windows: Array<{ remaining: number }>,
    minRemaining = 0,
  ) => windows.every((w) => w.remaining > minRemaining),
  rateLimitHeadersFromUsage: () => ({
    "X-RateLimit-Limit": "3",
    "X-RateLimit-Remaining": "0",
    "Retry-After": "60",
  }),
  rateLimitResponseHeaders: () => ({
    "X-RateLimit-Limit": "3",
    "X-RateLimit-Remaining": "0",
    "Retry-After": "60",
  }),
}));

vi.mock("@/lib/byok-keys", () => ({
  BYOK_KEYS_FAILED_USER_MESSAGE: "BYOK keys failed",
  loadDecryptedOpenRouterKeys: mockLoadByokKeys,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: mockCreateClient,
}));

vi.mock("@/lib/ai/provider", () => ({
  getOpenRouterApiKeys: mockGetOpenRouterKeys,
  isOpenRouterKeyUnusableError: () => false,
}));

import { POST } from "@/app/api/agent/research/route";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

async function postResearch(body: unknown = { jobId: JOB_ID }) {
  return POST(
    new Request("http://localhost/api/agent/research", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/agent/research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      success: true,
      user: { id: "user-1", email: "a@b.com" },
      accessToken: "token",
    });
    mockEnforceIpRateLimit.mockResolvedValue({ enforced: false });
    mockCanUseQuota.mockResolvedValue({ checked: false });
    mockLoadByokKeys.mockResolvedValue([]);
    mockResearchCompany.mockResolvedValue({
      success: true,
      research: {
        companyOverview: "Overview",
        techStack: [],
        culture: [],
        whyThisRole: "Why",
        yourEdge: [],
        gapsToAddress: [],
        smartQuestions: [],
        interviewPrep: [],
        sources: [],
      },
      homepageUrl: "https://example.com",
      browsed: true,
      degraded: false,
    });
  });

  it("returns 401 when unauthorized", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });
    const response = await postResearch();
    expect(response.status).toBe(401);
    expect(mockResearchCompany).not.toHaveBeenCalled();
  });

  it("returns 429 when IP rate limit is exceeded before work", async () => {
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

    const response = await postResearch();
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "Too many requests from this network. Please try again later.",
    });
    expect(mockCanUseQuota).not.toHaveBeenCalled();
    expect(mockResearchCompany).not.toHaveBeenCalled();
  });

  it("returns 429 when user admission quota is exhausted", async () => {
    mockCanUseQuota.mockResolvedValue({
      checked: true,
      allowed: false,
      windows: [
        {
          name: "minute",
          allowed: false,
          limit: 3,
          remaining: 0,
          used: 3,
          resetAt: Date.now() + 60_000,
        },
      ],
    });

    const response = await postResearch();
    expect(response.status).toBe(429);
    expect(mockResearchCompany).not.toHaveBeenCalled();
  });

  it("returns 429 when remaining usage is below the fixed research charge of 5", async () => {
    mockCanUseQuota.mockResolvedValue({
      checked: true,
      allowed: true,
      windows: [
        {
          name: "minute",
          allowed: true,
          limit: 15,
          remaining: 4,
          used: 11,
          resetAt: Date.now() + 60_000,
        },
        {
          name: "hour",
          allowed: true,
          limit: 40,
          remaining: 20,
          used: 20,
          resetAt: Date.now() + 3_600_000,
        },
      ],
    });

    const response = await postResearch();
    expect(response.status).toBe(429);
    expect(mockResearchCompany).not.toHaveBeenCalled();
  });

  it("admits research when remaining usage is at least 5", async () => {
    mockCanUseQuota.mockResolvedValue({
      checked: true,
      allowed: true,
      windows: [
        {
          name: "minute",
          allowed: true,
          limit: 15,
          remaining: 5,
          used: 10,
          resetAt: Date.now() + 60_000,
        },
      ],
    });

    const response = await postResearch();
    expect(response.status).toBe(200);
    expect(mockResearchCompany).toHaveBeenCalled();
  });

  it("skips user quota when BYOK keys are present", async () => {
    mockLoadByokKeys.mockResolvedValue(["sk-or-v1-user"]);
    const response = await postResearch();
    expect(response.status).toBe(200);
    expect(mockCanUseQuota).not.toHaveBeenCalled();
    expect(mockResearchCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        openRouter: { keys: ["sk-or-v1-user"] },
        rateLimit: undefined,
      }),
    );
  });

  it("returns research dossier on success", async () => {
    const response = await postResearch();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.research.companyOverview).toBe("Overview");
  });
});
