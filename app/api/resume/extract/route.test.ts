/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuth,
  mockExtractPdfText,
  mockGenerateObject,
  mockGetLanguageModel,
  FakeNoObjectGeneratedError,
} = vi.hoisted(() => {
  class FakeNoObjectGeneratedError extends Error {
    text: string;
    cause: { value?: unknown };

    constructor(text: string, value?: unknown) {
      super("No object generated");
      this.name = "AI_NoObjectGeneratedError";
      this.text = text;
      this.cause = { value };
    }

    static isInstance(
      error: unknown,
    ): error is FakeNoObjectGeneratedError {
      return error instanceof FakeNoObjectGeneratedError;
    }
  }

  return {
    mockRequireAuth: vi.fn(),
    mockExtractPdfText: vi.fn(),
    mockGenerateObject: vi.fn(),
    mockGetLanguageModel: vi.fn(() => "mock-model"),
    FakeNoObjectGeneratedError,
  };
});

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/pdf-text", () => ({
  extractPdfContent: mockExtractPdfText,
  extractPdfText: mockExtractPdfText,
}));

vi.mock("@/lib/ai/provider", () => ({
  getLanguageModel: mockGetLanguageModel,
  withOpenRouterKeyFailover: async (
    run: (model: unknown) => Promise<unknown>,
  ) => run(mockGetLanguageModel()),
}));

vi.mock("ai", () => ({
  generateObject: mockGenerateObject,
  NoObjectGeneratedError: FakeNoObjectGeneratedError,
}));

import { POST } from "@/app/api/resume/extract/route";
import { EMPTY_RESUME_TEXT_ERROR } from "@/lib/resume-extract";

function pdfFile(content: string, name = "resume.pdf") {
  return new File([content], name, { type: "application/pdf" });
}

async function postWithFile(
  file: File | null,
  headers: HeadersInit = { Authorization: "Bearer token" },
) {
  const form = new FormData();
  if (file) form.set("resume", file);
  return POST(
    new Request("http://localhost/api/resume/extract", {
      method: "POST",
      headers,
      body: form,
    }),
  );
}

describe("POST /api/resume/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      success: true,
      user: { id: "user-1", email: "a@b.com" },
      accessToken: "token",
    });
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await postWithFile(pdfFile("%PDF"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
  });

  it("returns 400 when resume file is missing", async () => {
    const response = await postWithFile(null);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Resume PDF is required",
    });
  });

  it("returns the exact empty-text error when PDF text is too short", async () => {
    mockExtractPdfText.mockResolvedValue({ text: "short", links: [] });

    const response = await postWithFile(pdfFile("%PDF"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: EMPTY_RESUME_TEXT_ERROR,
    });
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns extracted profile data on success with inferred salary", async () => {
    mockExtractPdfText.mockResolvedValue({ text: "a".repeat(80), links: [] });
    const extracted = {
      full_name: "Jane Doe",
      phone: null,
      location: "San Francisco, CA",
      current_title: "Engineer",
      experience_level: "mid" as const,
      years_experience: 4,
      skills: ["TypeScript"],
      industries: [],
      work_experience: [],
      education: {},
      job_titles_seeking: [],
      remote_preference: null,
      preferred_locations: [],
      salary_expectation: null,
      linkedin_url: null,
      portfolio_url: null,
      work_authorization: null,
    };
    mockGenerateObject.mockResolvedValue({ object: extracted });

    const response = await postWithFile(pdfFile("%PDF-1.4"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      full_name: "Jane Doe",
      location: "San Francisco, CA",
      current_title: "Engineer",
      experience_level: "mid",
      years_experience: 4,
      skills: ["TypeScript"],
      salary_expectation: "$100,000 - $140,000",
      job_titles_seeking: ["Engineer"],
    });
    expect(mockGetLanguageModel).toHaveBeenCalled();
    expect(mockGenerateObject).toHaveBeenCalled();
  });

  it("heals NoObjectGeneratedError partial text into a success response", async () => {
    mockExtractPdfText.mockResolvedValue({ text: "a".repeat(80), links: [] });
    mockGenerateObject.mockRejectedValue(
      new FakeNoObjectGeneratedError(
        '{"phone":"+91 8707 392 404","location":"","name":"ARYAN SRIVASTAVA","email":"a@b.com"}',
        {
          phone: "+91 8707 392 404",
          location: "",
          name: "ARYAN SRIVASTAVA",
          email: "a@b.com",
        },
      ),
    );

    const response = await postWithFile(pdfFile("%PDF"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.full_name).toBe("ARYAN SRIVASTAVA");
    expect(body.data.phone).toBe("+91 8707 392 404");
  });

  it("returns 502 when the model call fails without healable payload", async () => {
    mockExtractPdfText.mockResolvedValue({ text: "a".repeat(80), links: [] });
    mockGenerateObject.mockRejectedValue(new Error("rate limited"));

    const response = await postWithFile(pdfFile("%PDF"));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Could not extract profile from this resume. Please try again.",
    });
  });
});
