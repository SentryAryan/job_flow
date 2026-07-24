import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_PROFILE } from "@/lib/mock-profile";

const {
  mockUploadResume,
  mockFetchResumeBlob,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockUploadResume: vi.fn(),
  mockFetchResumeBlob: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/profile", () => ({
  uploadResume: mockUploadResume,
  fetchResumeBlob: mockFetchResumeBlob,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { ResumeUpload } from "@/components/profile/ResumeUpload";

const resumeUrl =
  "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";

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

    const { container } = render(
      <ResumeUpload
        userId="user-1"
        resumePdfUrl={null}
        onUploaded={onUploaded}
      />,
    );

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

    const { container } = render(
      <ResumeUpload
        userId="user-1"
        resumePdfUrl={null}
        onUploaded={vi.fn()}
      />,
    );

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

    render(
      <ResumeUpload
        userId="user-1"
        resumePdfUrl={resumeUrl}
        onUploaded={vi.fn()}
      />,
    );

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

    render(
      <ResumeUpload
        userId="user-1"
        resumePdfUrl={resumeUrl}
        onUploaded={vi.fn()}
      />,
    );

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

    render(
      <ResumeUpload
        userId="user-1"
        resumePdfUrl={resumeUrl}
        onUploaded={vi.fn()}
      />,
    );

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
});
