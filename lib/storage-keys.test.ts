import { describe, expect, it } from "vitest";

import {
    extractStorageObjectKey,
    resolveResumeStorageKey,
    resumeObjectKey,
} from "@/lib/storage-keys";

describe("storage-keys", () => {
  it("builds the canonical resume key", () => {
    expect(resumeObjectKey("user-1")).toBe("user-1/resume.pdf");
  });

  it("extracts object keys from InsForge storage URLs", () => {
    const url =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume.pdf";
    expect(extractStorageObjectKey(url)).toBe("user-1/resume.pdf");
  });

  it("returns null for non-storage URLs", () => {
    expect(extractStorageObjectKey("https://example.com/resume.pdf")).toBe(
      null,
    );
    expect(extractStorageObjectKey("not-a-url")).toBe(null);
  });

  it("resolves keys from saved URLs with canonical fallback", () => {
    const url =
      "https://example.insforge.app/api/storage/buckets/resumes/objects/user-1%2Fresume-renamed.pdf";
    expect(resolveResumeStorageKey("user-1", url)).toBe(
      "user-1/resume-renamed.pdf",
    );
    expect(resolveResumeStorageKey("user-1", null)).toBe("user-1/resume.pdf");
    expect(resolveResumeStorageKey("user-1", "https://bad.example/x")).toBe(
      "user-1/resume.pdf",
    );
  });
});
