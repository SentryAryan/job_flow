/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { MOCK_PROFILE } from "@/lib/mock-profile";
import {
    buildResumePdfModel,
    canGenerateResume,
    finalizeResumeGenerate,
    healGenerateFromError,
    MAX_BULLETS_PER_ROLE,
    MAX_EXPERIENCE_ROLES,
    parseGenerateFromModelText,
    polishResumeFromProfile,
    resumeGenerateSchema,
    truncateForOnePage,
} from "@/lib/resume-generate";
import type { Profile } from "@/types";

describe("canGenerateResume", () => {
  it("requires full_name and at least one content section", () => {
    expect(canGenerateResume({ ...MOCK_PROFILE, full_name: null })).toBe(false);
    expect(
      canGenerateResume({
        ...MOCK_PROFILE,
        full_name: "Ada",
        skills: [],
        work_experience: [],
        education: {},
      }),
    ).toBe(false);
    expect(canGenerateResume(MOCK_PROFILE)).toBe(true);
  });

  it("accepts education-only, skills-only, or experience-only", () => {
    const base: Profile = {
      ...MOCK_PROFILE,
      skills: [],
      work_experience: [],
      education: {},
    };
    expect(
      canGenerateResume({
        ...base,
        education: { institution: "MIT", degree: "BS" },
      }),
    ).toBe(true);
    expect(canGenerateResume({ ...base, skills: ["React"] })).toBe(true);
    expect(
      canGenerateResume({
        ...base,
        work_experience: MOCK_PROFILE.work_experience,
      }),
    ).toBe(true);
  });
});

describe("finalizeResumeGenerate", () => {
  it("normalizes AI output and caps bullets/roles", () => {
    const raw = {
      summary: "  Senior engineer with React focus.  ",
      experience: [
        {
          bullets: ["Built X", "", "Led Y", "Extra 1", "Extra 2", "Extra 3"],
        },
      ],
      skills_line: "React, TypeScript",
      industries_line: "SaaS",
    };

    const result = finalizeResumeGenerate(raw, MOCK_PROFILE);
    expect(result.summary).toBe("Senior engineer with React focus.");
    expect(result.experience).toHaveLength(1);
    expect(result.experience[0]!.bullets.length).toBeLessThanOrEqual(
      MAX_BULLETS_PER_ROLE,
    );
    expect(result.experience[0]!.bullets).toEqual([
      "Built X",
      "Led Y",
      "Extra 1",
      "Extra 2",
    ]);
    expect(result.skills_line).toBe("React, TypeScript");
    expect(result.industries_line).toBe("SaaS");
  });

  it("falls back to profile responsibilities when AI bullets empty", () => {
    const result = finalizeResumeGenerate(
      { summary: "Hello", experience: [{ bullets: [] }] },
      MOCK_PROFILE,
    );
    expect(result.experience[0]!.bullets.length).toBeGreaterThan(0);
    expect(result.summary).toBe("Hello");
  });
});

describe("truncateForOnePage", () => {
  it("limits experience roles to MAX_EXPERIENCE_ROLES keeping newest first", () => {
    const roles = Array.from({ length: 8 }, (_, i) => ({
      company: `Co${i}`,
      title: `Title${i}`,
      start_date: `202${i}-01`,
      end_date: null as string | null,
      is_current: i === 0,
      bullets: ["Did work"],
    }));

    const truncated = truncateForOnePage({
      summary: "x".repeat(500),
      experience: roles,
      skills_line: null,
      industries_line: null,
    });

    expect(truncated.experience).toHaveLength(MAX_EXPERIENCE_ROLES);
    expect(truncated.experience[0]!.company).toBe("Co0");
    expect(truncated.summary.length).toBeLessThanOrEqual(320);
  });
});

describe("buildResumePdfModel", () => {
  it("omits empty education and builds contact/links from profile", () => {
    const profile: Profile = { ...MOCK_PROFILE, education: {} };
    const polished = finalizeResumeGenerate(
      {
        summary: "Summary here.",
        experience: [{ bullets: ["Ship features"] }],
        skills_line: "React, TypeScript",
        industries_line: null,
      },
      profile,
    );

    const model = buildResumePdfModel(profile, polished);
    expect(model.full_name).toBe("Faizan Ali");
    expect(model.current_title).toBe("Frontend Engineer");
    expect(model.contactParts.length).toBeGreaterThan(0);
    expect(model.links.some((l) => l.label === "LinkedIn")).toBe(true);
    expect(model.links.some((l) => l.label === "Portfolio")).toBe(true);
    expect(model.education).toBeNull();
    expect(model.skills_line).toBe("React, TypeScript");
    expect(model.summary).toBe("Summary here.");
  });

  it("includes education when institution or degree present", () => {
    const profile: Profile = {
      ...MOCK_PROFILE,
      education: {
        degree: "BS",
        field_of_study: "CS",
        institution: "MIT",
        graduation_year: "2020",
      },
    };
    const polished = finalizeResumeGenerate(
      { summary: "S", experience: [{ bullets: ["A"] }], skills_line: null, industries_line: null },
      profile,
    );
    const model = buildResumePdfModel(profile, polished);
    expect(model.education).not.toBeNull();
    expect(model.education!.institution).toBe("MIT");
  });
});

describe("resumeGenerateSchema", () => {
  it("parses valid AI payload", () => {
    const parsed = resumeGenerateSchema.parse({
      summary: "A summary",
      experience: [{ bullets: ["One", "Two"] }],
      skills_line: "React",
      industries_line: null,
    });
    expect(parsed.summary).toBe("A summary");
  });
});

describe("parseGenerateFromModelText / healGenerateFromError", () => {
  const markdownProse = `**Summary**
Full Stack Web Developer with 1 year of experience specializing in Next.js, React, and Java back-end development.

**Experience**

**Genpact – Full Stack Web Developer** (2024-10 – Present)
- Designed and maintained internal applications
- Implemented advanced UI/UX features
- Built secure back-ends with Clerk
- Deployed to AWS and Docker

**Internshala – Web Developer Intern** (2023-09 – 2024-09)
- Delivered three full-stack applications
- Converted Figma designs into responsive UIs
- Engineered secure authentication systems

**Skills**
JavaScript, TypeScript, React, Next.js

**Industries**
Software Development, Information Technology`;

  const twoRoleProfile: Profile = {
    ...MOCK_PROFILE,
    work_experience: [
      {
        company: "Genpact",
        title: "Full Stack Web Developer",
        start_date: "2024-10",
        end_date: null,
        is_current: true,
        responsibilities: "Built apps",
      },
      {
        company: "Internshala",
        title: "Web Developer Intern",
        start_date: "2023-09",
        end_date: "2024-09",
        is_current: false,
        responsibilities: "Intern work",
      },
    ],
  };

  it("recovers polished content from free-model markdown prose", () => {
    const polished = parseGenerateFromModelText(markdownProse, twoRoleProfile);
    expect(polished).not.toBeNull();
    expect(polished!.summary).toMatch(/Full Stack/i);
    expect(polished!.experience).toHaveLength(2);
    expect(polished!.experience[0]!.bullets[0]).toMatch(/Designed/i);
    expect(polished!.experience[1]!.bullets[0]).toMatch(/Delivered/i);
    expect(polished!.skills_line).toMatch(/JavaScript/);
    expect(polished!.industries_line).toMatch(/Software Development/);
  });

  it("heals NoObjectGeneratedError-shaped errors with .text", () => {
    const error = {
      name: "AI_NoObjectGeneratedError",
      message: "No object generated",
      text: markdownProse,
    };
    const healed = healGenerateFromError(error, twoRoleProfile);
    expect(healed).not.toBeNull();
    expect(healed!.summary).toMatch(/Full Stack/i);
  });

  it("polishResumeFromProfile always returns usable content", () => {
    const polished = polishResumeFromProfile(MOCK_PROFILE);
    expect(polished.summary.length).toBeGreaterThan(0);
    expect(polished.experience[0]!.bullets.length).toBeGreaterThan(0);
  });
});
