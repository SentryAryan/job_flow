/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_PROFILE } from "@/lib/mock-profile";

const {
  mockRequireAuth,
  mockGenerateObject,
  mockGetLanguageModel,
  mockEnforceRateLimit,
  mockRenderResumePdfBuffer,
  mockCreateClient,
  mockSelectSingle,
  mockUpdateSingle,
  mockUpload,
  mockRemove,
  mockLoadByokKeys,
} = vi.hoisted(() => {
  const mockSelectSingle = vi.fn();
  const mockUpdateSingle = vi.fn();
  const mockUpload = vi.fn();
  const mockRemove = vi.fn();

  const mockCreateClient = vi.fn(() => ({
    database: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: mockSelectSingle,
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: mockUpdateSingle,
            }),
          }),
        }),
      }),
    },
    storage: {
      from: () => ({
        upload: mockUpload,
        remove: mockRemove,
      }),
    },
  }));

  return {
    mockRequireAuth: vi.fn(),
    mockGenerateObject: vi.fn(),
    mockGetLanguageModel: vi.fn(() => "mock-model"),
    mockEnforceRateLimit: vi.fn(async (): Promise<
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
    mockRenderResumePdfBuffer: vi.fn(async () => Buffer.from("%PDF-1.4")),
    mockCreateClient,
    mockSelectSingle,
    mockUpdateSingle,
    mockUpload,
    mockRemove,
    mockLoadByokKeys: vi.fn(async () => [] as string[]),
  };
});

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/ai/provider", () => ({
  getLanguageModel: mockGetLanguageModel,
  withOpenRouterKeyFailover: async (
    run: (model: unknown) => Promise<unknown>,
  ) => run(mockGetLanguageModel()),
}));

vi.mock("@/lib/resume-ai-rate-limit", () => ({
  enforceResumeAiRateLimit: mockEnforceRateLimit,
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

vi.mock("@/lib/resume-pdf/DemoResumeDocument", () => ({
  renderResumePdfBuffer: mockRenderResumePdfBuffer,
}));

vi.mock("@/lib/byok-keys", () => ({
  loadDecryptedOpenRouterKeys: mockLoadByokKeys,
}));

vi.mock("@insforge/sdk", () => ({
  createClient: mockCreateClient,
}));

vi.mock("ai", () => ({
  generateObject: mockGenerateObject,
}));

import { POST } from "@/app/api/resume/generate/route";

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_PROFILE.id,
    full_name: MOCK_PROFILE.full_name,
    email: MOCK_PROFILE.email,
    phone: MOCK_PROFILE.phone,
    location: MOCK_PROFILE.location,
    current_title: MOCK_PROFILE.current_title,
    experience_level: MOCK_PROFILE.experience_level,
    years_experience: MOCK_PROFILE.years_experience,
    skills: MOCK_PROFILE.skills,
    industries: MOCK_PROFILE.industries,
    work_experience: MOCK_PROFILE.work_experience,
    education: MOCK_PROFILE.education,
    job_titles_seeking: MOCK_PROFILE.job_titles_seeking,
    remote_preference: MOCK_PROFILE.remote_preference,
    preferred_locations: MOCK_PROFILE.preferred_locations,
    salary_expectation: MOCK_PROFILE.salary_expectation,
    cover_letter_tone: MOCK_PROFILE.cover_letter_tone,
    linkedin_url: MOCK_PROFILE.linkedin_url,
    portfolio_url: MOCK_PROFILE.portfolio_url,
    work_authorization: MOCK_PROFILE.work_authorization,
    resume_pdf_url: MOCK_PROFILE.resume_pdf_url,
    is_complete: MOCK_PROFILE.is_complete,
    created_at: MOCK_PROFILE.created_at,
    updated_at: MOCK_PROFILE.updated_at,
    ...overrides,
  };
}

async function postGenerate(
  headers: HeadersInit = { Authorization: "Bearer token" },
) {
  return POST(
    new Request("http://localhost/api/resume/generate", {
      method: "POST",
      headers,
    }),
  );
}

describe("POST /api/resume/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      success: true,
      user: { id: "user-1", email: "a@b.com" },
      accessToken: "token",
    });
    mockEnforceRateLimit.mockResolvedValue({ enforced: false });
    mockLoadByokKeys.mockResolvedValue([]);
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.APP_ENV = "development";
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://example.insforge.app";
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = "anon";

    mockSelectSingle.mockResolvedValue({
      data: profileRow({ id: "user-1" }),
      error: null,
    });
    mockGenerateObject.mockResolvedValue({
      object: {
        summary: "Frontend engineer focused on React.",
        experience: [{ bullets: ["Built features", "Improved CWV"] }],
        skills_line: "React, TypeScript",
        industries_line: null,
      },
    });
    mockUpload.mockResolvedValue({
      data: {
        url: "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf",
        key: "user-1/resume.pdf",
      },
      error: null,
    });
    mockUpdateSingle.mockResolvedValue({
      data: {
        resume_pdf_url:
          "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf",
      },
      error: null,
    });
    mockRemove.mockResolvedValue({ data: { message: "ok" }, error: null });
  });

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await postGenerate();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
  });

  it("returns 429 when rate limited", async () => {
    mockEnforceRateLimit.mockResolvedValue({
      enforced: true,
      result: {
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAt: Date.now() + 60_000,
        blockedBy: "1m",
      },
    });

    const response = await postGenerate();
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("skips shared rate limits when BYOK keys are present", async () => {
    mockLoadByokKeys.mockResolvedValue(["sk-or-v1-user-key-abcdef"]);
    mockEnforceRateLimit.mockResolvedValue({
      enforced: true,
      result: {
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAt: Date.now() + 60_000,
        blockedBy: "1m",
      },
    });

    const response = await postGenerate();
    expect(response.status).toBe(200);
    expect(mockEnforceRateLimit).not.toHaveBeenCalled();
  });

  it("returns 400 when profile lacks minimum content", async () => {
    mockSelectSingle.mockResolvedValue({
      data: profileRow({
        id: "user-1",
        full_name: null,
        skills: [],
        work_experience: [],
        education: {},
      }),
      error: null,
    });

    const response = await postGenerate();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/name/i);
  });

  it("generates, uploads, and returns resume_pdf_url", async () => {
    const response = await postGenerate();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.resume_pdf_url).toContain("resume.pdf");
    expect(mockGenerateObject).toHaveBeenCalled();
    expect(mockRenderResumePdfBuffer).toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalled();
    expect(mockUpdateSingle).toHaveBeenCalled();
  });

  it("falls back to profile polish when AI fails entirely", async () => {
    mockGenerateObject.mockRejectedValue(new Error("model down"));
    const response = await postGenerate();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.resume_pdf_url).toContain("resume.pdf");
    expect(mockRenderResumePdfBuffer).toHaveBeenCalled();
  });

  it("heals markdown prose from NoObjectGeneratedError and succeeds", async () => {
    class FakeNoObjectGeneratedError extends Error {
      text: string;
      constructor(text: string) {
        super("No object generated");
        this.name = "AI_NoObjectGeneratedError";
        this.text = text;
      }
    }

    mockGenerateObject.mockRejectedValue(
      new FakeNoObjectGeneratedError(`**Summary**
Frontend engineer with React focus.

**Experience**

**Vercel – Frontend Engineer** (2022-01 – Present)
- Built front-end features
- Optimized Core Web Vitals

**Skills**
React, TypeScript

**Industries**
SaaS`),
    );

    const response = await postGenerate();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockRenderResumePdfBuffer).toHaveBeenCalled();
    const firstCall = mockRenderResumePdfBuffer.mock.calls.at(0) as
      | [{ summary?: string; experience?: { bullets: string[] }[] }]
      | undefined;
    const modelArg = firstCall?.[0];
    expect(modelArg?.summary).toMatch(/Frontend engineer/i);
    expect(modelArg?.experience?.[0]?.bullets.length).toBeGreaterThan(0);
  });

  it("returns 404 when profile row missing", async () => {
    mockSelectSingle.mockResolvedValue({ data: null, error: { message: "none" } });
    const response = await postGenerate();
    expect(response.status).toBe(404);
  });
});
