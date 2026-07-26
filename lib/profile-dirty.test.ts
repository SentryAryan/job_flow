import { describe, expect, it } from "vitest";

import { MOCK_PROFILE } from "@/lib/mock-profile";
import { isProfileDirty } from "@/lib/profile-dirty";

describe("isProfileDirty", () => {
  it("returns false when profiles match for resume-relevant fields", () => {
    const a = { ...MOCK_PROFILE };
    const b = { ...MOCK_PROFILE, resume_pdf_url: "https://other/url.pdf" };
    expect(isProfileDirty(a, b)).toBe(false);
  });

  it("returns true when a content field changes", () => {
    expect(
      isProfileDirty(MOCK_PROFILE, {
        ...MOCK_PROFILE,
        full_name: "Other Name",
      }),
    ).toBe(true);
    expect(
      isProfileDirty(MOCK_PROFILE, {
        ...MOCK_PROFILE,
        skills: [...MOCK_PROFILE.skills, "Go"],
      }),
    ).toBe(true);
  });

  it("returns true when baseline is null", () => {
    expect(isProfileDirty(MOCK_PROFILE, null)).toBe(true);
  });
});
