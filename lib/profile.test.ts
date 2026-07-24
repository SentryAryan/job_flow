import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_PROFILE } from "@/lib/mock-profile";
import {
    fetchProfile,
    fetchResumeBlob,
    profileSaveSchema,
    profileToSaveInput,
    saveProfile,
    uploadResume,
} from "@/lib/profile";

const {
  mockSingle,
  mockUpdate,
  mockUpload,
  mockRemove,
  mockDownload,
  mockEq,
  mockSelect,
} = vi.hoisted(() => {
    const mockSingle = vi.fn();
    const mockEq = vi.fn();
    const mockSelect = vi.fn();
    const mockUpdate = vi.fn();
    const mockUpload = vi.fn();
    const mockRemove = vi.fn();
    const mockDownload = vi.fn();

    mockEq.mockReturnValue({ select: mockSelect, single: mockSingle });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });

    return {
      mockSingle,
      mockUpdate,
      mockUpload,
      mockRemove,
      mockDownload,
      mockEq,
      mockSelect,
    };
  });

vi.mock("@/lib/insforge-client", () => ({
  insforge: {
    database: {
      from: vi.fn(() => ({
        update: mockUpdate,
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        remove: mockRemove,
        download: mockDownload,
      })),
    },
  },
}));

function completeProfileInput() {
  return profileToSaveInput({
    ...MOCK_PROFILE,
    phone: "555-0100",
    location: "Remote",
    education: {
      degree: "BS",
      field_of_study: "CS",
      institution: "State U",
      graduation_year: "2020",
    },
  });
}

describe("fetchProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ select: mockSelect, single: mockSingle });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it("maps a database row to a Profile", async () => {
    mockSingle.mockResolvedValue({
      data: { ...MOCK_PROFILE, id: "user-1" },
      error: null,
    });

    const result = await fetchProfile("user-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("user-1");
      expect(result.data.full_name).toBe(MOCK_PROFILE.full_name);
    }
  });

  it("returns a timeout-friendly error", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Request timed out" },
    });

    const result = await fetchProfile("user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Request timed out. Please try again.");
    }
  });
});

describe("profileSaveSchema", () => {
  it("rejects invalid linkedin URLs", () => {
    const result = profileSaveSchema.safeParse({
      ...completeProfileInput(),
      linkedin_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty or null URLs", () => {
    expect(
      profileSaveSchema.safeParse({
        ...completeProfileInput(),
        linkedin_url: null,
        portfolio_url: "",
      }).success,
    ).toBe(true);
  });

  it("allows valid http(s) URLs", () => {
    expect(
      profileSaveSchema.safeParse({
        ...completeProfileInput(),
        linkedin_url: "https://linkedin.com/in/test",
        portfolio_url: "http://example.com",
      }).success,
    ).toBe(true);
  });
});

describe("profileToSaveInput", () => {
  it("clears incomplete year-month dates", () => {
    const input = profileToSaveInput({
      ...MOCK_PROFILE,
      work_experience: [
        {
          company: "Acme",
          title: "Eng",
          start_date: "2024-",
          end_date: "-03",
          is_current: false,
          responsibilities: "Shipped",
        },
      ],
    });

    expect(input.work_experience[0]?.start_date).toBe("");
    expect(input.work_experience[0]?.end_date).toBeNull();
  });

  it("keeps complete year-month dates", () => {
    const input = profileToSaveInput({
      ...MOCK_PROFILE,
      work_experience: [
        {
          company: "Acme",
          title: "Eng",
          start_date: "2024-03",
          end_date: "2025-01",
          is_current: false,
          responsibilities: "Shipped",
        },
      ],
    });

    expect(input.work_experience[0]?.start_date).toBe("2024-03");
    expect(input.work_experience[0]?.end_date).toBe("2025-01");
  });
});

describe("saveProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ select: mockSelect, single: mockSingle });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it("persists is_complete true when required fields are filled", async () => {
    const savedRow = {
      ...MOCK_PROFILE,
      phone: "555-0100",
      location: "Remote",
      education: {
        degree: "BS",
        field_of_study: "CS",
        institution: "State U",
        graduation_year: "2020",
      },
      is_complete: true,
    };

    mockSingle.mockResolvedValue({ data: savedRow, error: null });

    const result = await saveProfile("mock-user-id", completeProfileInput(), {
      email: MOCK_PROFILE.email,
      resume_pdf_url: null,
      cover_letter_tone: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_complete).toBe(true);
    }
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_complete: true }),
    );
  });

  it("returns a URL-specific error for invalid portfolio URLs", async () => {
    const result = await saveProfile(
      "mock-user-id",
      { ...completeProfileInput(), portfolio_url: "ftp://bad" },
      {
        email: MOCK_PROFILE.email,
        resume_pdf_url: null,
        cover_letter_tone: null,
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/URL/i);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("surfaces timeout-friendly errors", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Request timed out" },
    });

    const result = await saveProfile("mock-user-id", completeProfileInput(), {
      email: MOCK_PROFILE.email,
      resume_pdf_url: null,
      cover_letter_tone: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Save timed out. Please try again.");
    }
  });
});

describe("uploadResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ select: mockSelect, single: mockSingle });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockRemove.mockResolvedValue({ data: { message: "ok" }, error: null });
  });

  it("rejects non-PDF files without calling storage", async () => {
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    const result = await uploadResume("user-1", file);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Only PDF files are allowed");
    }
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects files over 5MB", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", {
      type: "application/pdf",
    });
    const result = await uploadResume("user-1", big);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Maximum file size is 5MB");
    }
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("uploads first, then removes only stale prior keys", async () => {
    const previousUrl =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume-old.pdf";
    mockUpload.mockResolvedValue({
      data: {
        url: "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf",
        key: "user-1/resume.pdf",
      },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { ...MOCK_PROFILE, id: "user-1", resume_pdf_url: "https://new" },
      error: null,
    });

    const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
    const result = await uploadResume("user-1", file, { previousUrl });

    expect(result.success).toBe(true);
    expect(mockUpload).toHaveBeenCalledWith("user-1/resume.pdf", file);
    expect(mockRemove).toHaveBeenCalledWith("user-1/resume-old.pdf");
    expect(mockRemove).not.toHaveBeenCalledWith("user-1/resume.pdf");
  });

  it("does not remove the existing resume when upload fails", async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: "upload failed" },
    });

    const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
    const result = await uploadResume("user-1", file, {
      previousUrl:
        "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf",
    });

    expect(result.success).toBe(false);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("ignores Object not found when cleaning up stale keys after rename", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpload.mockResolvedValue({
      data: {
        url: "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume-abc.pdf",
        key: "user-1/resume-abc.pdf",
      },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        ...MOCK_PROFILE,
        id: "user-1",
        resume_pdf_url:
          "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume-abc.pdf",
      },
      error: null,
    });
    mockRemove.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });

    const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
    const result = await uploadResume("user-1", file, {
      previousUrl:
        "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf",
    });

    expect(result.success).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith("user-1/resume.pdf");
    expect(consoleError).not.toHaveBeenCalledWith(
      "[lib/profile] uploadResume remove",
      expect.anything(),
      expect.anything(),
    );
    consoleError.mockRestore();
  });

  it("retries once after clearing stale keys on transient upload failure", async () => {
    const previousUrl =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";
    mockUpload
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Request timed out after 30000ms" },
      })
      .mockResolvedValueOnce({
        data: {
          url: "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf",
          key: "user-1/resume.pdf",
        },
        error: null,
      });
    mockSingle.mockResolvedValue({
      data: { ...MOCK_PROFILE, id: "user-1", resume_pdf_url: "https://new" },
      error: null,
    });

    const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
    const result = await uploadResume("user-1", file, { previousUrl });

    expect(result.success).toBe(true);
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledWith("user-1/resume.pdf");
  });

  it("surfaces a timeout-friendly upload error", async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: "Request timed out after 90000ms" },
    });

    const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
    const result = await uploadResume("user-1", file);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Upload timed out. Check your connection and try again.",
      );
    }
  });
});

describe("fetchResumeBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error when no resume URL is saved", async () => {
    const result = await fetchResumeBlob("user-1", null);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("No resume on file");
    }
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("downloads using the key parsed from the saved URL", async () => {
    const resumeUrl =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    mockDownload.mockResolvedValue({ data: blob, error: null });

    const result = await fetchResumeBlob("user-1", resumeUrl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(blob);
      expect(result.data.type).toBe("application/pdf");
    }
    expect(mockDownload).toHaveBeenCalledWith("user-1/resume.pdf");
  });

  it("normalizes untyped blobs to application/pdf", async () => {
    const resumeUrl =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";
    mockDownload.mockResolvedValue({
      data: new Blob(["%PDF"], { type: "" }),
      error: null,
    });

    const result = await fetchResumeBlob("user-1", resumeUrl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("application/pdf");
    }
  });

  it("surfaces a timeout-friendly download error", async () => {
    const resumeUrl =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: "Request timed out after 90000ms" },
    });

    const result = await fetchResumeBlob("user-1", resumeUrl);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Request timed out. Please try again.");
    }
  });
});
