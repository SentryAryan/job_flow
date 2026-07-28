import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_PROFILE } from "@/lib/mock-profile";

const {
  mockUploadResume,
  mockFetchResumeBlob,
  mockToastSuccess,
  mockToastError,
  mockAuthedFetch,
  mockCaptureEvent,
} = vi.hoisted(() => ({
  mockUploadResume: vi.fn(),
  mockFetchResumeBlob: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockAuthedFetch: vi.fn(),
  mockCaptureEvent: vi.fn(),
}));

vi.mock("@/lib/profile", () => ({
  uploadResume: mockUploadResume,
  fetchResumeBlob: mockFetchResumeBlob,
}));

vi.mock("@/lib/authed-fetch", () => ({
  authedFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));

vi.mock("@/lib/analytics", () => ({
  captureEvent: mockCaptureEvent,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { ResumeUpload } from "@/components/profile/ResumeUpload";
import type { ProfileExtract } from "@/lib/resume-extract";
import type { Profile } from "@/types";

const resumeUrl =
  "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";

function renderUpload(
  props: Partial<{
    resumePdfUrl: string | null;
    isDirty: boolean;
    onUploaded: (profile: Profile) => void;
    onExtracted: (extracted: ProfileExtract) => void;
    onGenerated: (resumePdfUrl: string) => void;
  }> = {},
) {
  return render(
    <ResumeUpload
      userId="user-1"
      resumePdfUrl={props.resumePdfUrl ?? null}
      isDirty={props.isDirty}
      onUploaded={props.onUploaded ?? vi.fn()}
      onExtracted={props.onExtracted ?? vi.fn()}
      onGenerated={props.onGenerated}
    />,
  );
}

describe("ResumeUpload", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResumeBlob.mockResolvedValue({
      success: true,
      data: new Blob(["%PDF"], { type: "application/pdf" }),
    });
    mockAuthedFetch.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) =>
        (globalThis.fetch as typeof fetch)(input, init),
    );
  });

  it("uploads a selected PDF and toasts success", async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    mockUploadResume.mockResolvedValue({
      success: true,
      data: {
        profile: { ...MOCK_PROFILE, resume_pdf_url: resumeUrl },
        url: resumeUrl,
      },
    });

    const { container } = renderUpload({ onUploaded });

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["%PDF"], "cv.pdf", { type: "application/pdf" });
    await user.upload(input, file);

    await waitFor(() => {
      expect(mockUploadResume).toHaveBeenCalledWith("user-1", file, {
        previousUrl: null,
      });
      expect(onUploaded).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Resume uploaded");
    });
  });

  it("toasts errors from failed uploads", async () => {
    const user = userEvent.setup();
    mockUploadResume.mockResolvedValue({
      success: false,
      error: "Failed to upload resume",
    });

    const { container } = renderUpload();

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["%PDF"], "cv.pdf", { type: "application/pdf" });
    await user.upload(input, file);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to upload resume");
    });
    expect(screen.getByText("Select Resume")).toBeInTheDocument();
  });

  it("loads an inline PDF preview when a resume URL is present", async () => {
    const createObjectURL = vi.fn(() => "blob:mock-resume");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    renderUpload({ resumePdfUrl: resumeUrl });

    expect(screen.queryByText("Resume on file")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetchResumeBlob).toHaveBeenCalledWith("user-1", resumeUrl);
      expect(screen.getByTitle("Resume preview")).toHaveAttribute(
        "src",
        "blob:mock-resume",
      );
    });
    expect(screen.getByRole("button", { name: /Expand/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("opens an expanded modal preview when Expand is clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-resume"),
      revokeObjectURL: vi.fn(),
    });

    renderUpload({ resumePdfUrl: resumeUrl });

    await waitFor(() => {
      expect(screen.getByTitle("Resume preview")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Expand/i }));

    expect(screen.getByRole("dialog", { name: "Resume preview" })).toBeInTheDocument();
    expect(screen.getByTitle("Expanded resume preview")).toHaveAttribute(
      "src",
      "blob:mock-resume",
    );
  });

  it("downloads the resume when Download is clicked", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    mockFetchResumeBlob.mockResolvedValue({ success: true, data: blob });

    const createObjectURL = vi.fn(() => "blob:mock-resume");
    const revokeObjectURL = vi.fn();
    const anchorClick = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName, options) => {
        if (tagName === "a") {
          return {
            click: anchorClick,
            download: "",
            href: "",
            rel: "",
          } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tagName, options);
      });

    renderUpload({ resumePdfUrl: resumeUrl });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(mockFetchResumeBlob).toHaveBeenCalledWith("user-1", resumeUrl);
      expect(createObjectURL).toHaveBeenCalled();
      expect(anchorClick).toHaveBeenCalled();
    });

    createElementSpy.mockRestore();
  });

  it("hides Extract from Resume when no resume is uploaded", () => {
    renderUpload({ resumePdfUrl: null });
    expect(
      screen.queryByRole("button", { name: "Extract from Resume" }),
    ).not.toBeInTheDocument();
  });

  it("extracts profile fields when Extract from Resume is clicked", async () => {
    const user = userEvent.setup();
    const onExtracted = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-resume"),
      revokeObjectURL: vi.fn(),
    });

    const extracted = {
      full_name: "Extracted",
      phone: null,
      location: null,
      current_title: null,
      experience_level: null,
      years_experience: null,
      skills: ["React"],
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

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: extracted }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderUpload({ resumePdfUrl: resumeUrl, onExtracted });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Extract from Resume" }),
      ).toBeEnabled();
    });

    await user.click(
      screen.getByRole("button", { name: "Extract from Resume" }),
    );

    await waitFor(() => {
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/api/resume/extract",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(onExtracted).toHaveBeenCalledWith(extracted);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Profile fields filled from resume — review and save",
      );
    });
  });

  it("shows Extracting... while the extract request is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-resume"),
      revokeObjectURL: vi.fn(),
    });

    let resolveFetch: (value: unknown) => void = () => {};
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(fetchPromise),
    );

    renderUpload({ resumePdfUrl: resumeUrl });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Extract from Resume" }),
      ).toBeEnabled();
    });

    await user.click(
      screen.getByRole("button", { name: "Extract from Resume" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Extracting..." }),
      ).toBeDisabled();
    });

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          full_name: null,
          phone: null,
          location: null,
          current_title: null,
          experience_level: null,
          years_experience: null,
          skills: [],
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
        },
      }),
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Extract from Resume" }),
      ).toBeEnabled();
    });
  });

  it("toasts save-first when Generate is clicked while dirty", async () => {
    const user = userEvent.setup();
    renderUpload({ isDirty: true });

    await user.click(
      screen.getByRole("button", { name: /Generate Resume/i }),
    );

    expect(mockToastError).toHaveBeenCalledWith(
      "Save your profile before generating",
    );
  });

  it("posts to generate API and calls onGenerated on success", async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    const generatedUrl =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { resume_pdf_url: generatedUrl },
        }),
      }),
    );

    renderUpload({ onGenerated });

    await user.click(
      screen.getByRole("button", { name: /Generate Resume/i }),
    );

    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledWith(generatedUrl);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Resume generated from your profile",
      );
      expect(mockCaptureEvent).toHaveBeenCalledWith("resume_generated", {
        userId: "user-1",
      });
    });

    expect(mockAuthedFetch).toHaveBeenCalledWith("/api/resume/generate", {
      method: "POST",
    });
  });
});
