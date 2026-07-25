import { describe, expect, it } from "vitest";

import { MOCK_PROFILE } from "@/lib/mock-profile";
import {
    EMPTY_RESUME_TEXT_ERROR,
    asResponsibilities,
    clearProfileFormFields,
    finalizeExtract,
    hasHeuristicExtractFields,
    hasSubstantiveExtractFields,
    inferSalaryExpectation,
    isResumeTextTooShort,
    mergeExtractedIntoProfile,
    normalizeDateToYearMonth,
    normalizeHighestDegree,
    normalizeRawExtract,
    parseExtractFromModelText,
    pickSocialProfileUrls,
    profileExtractSchema,
    type ProfileExtract,
} from "@/lib/resume-extract";

function emptyExtract(overrides: Partial<ProfileExtract> = {}): ProfileExtract {
  return {
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
    ...overrides,
  };
}

describe("isResumeTextTooShort", () => {
  it("returns true for empty or whitespace-only text", () => {
    expect(isResumeTextTooShort("")).toBe(true);
    expect(isResumeTextTooShort("   \n\t  ")).toBe(true);
  });

  it("returns true when trimmed length is under 50", () => {
    expect(isResumeTextTooShort("a".repeat(49))).toBe(true);
  });

  it("returns false when trimmed length is at least 50", () => {
    expect(isResumeTextTooShort("a".repeat(50))).toBe(false);
    expect(isResumeTextTooShort(`  ${"b".repeat(50)}  `)).toBe(false);
  });
});

describe("EMPTY_RESUME_TEXT_ERROR", () => {
  it("matches the Feature 07 user-facing message", () => {
    expect(EMPTY_RESUME_TEXT_ERROR).toBe(
      "Could not extract text from this PDF. Please try a different file.",
    );
  });
});

describe("profileExtractSchema", () => {
  it("accepts a valid extraction payload", () => {
    const parsed = profileExtractSchema.parse({
      full_name: "Jane Doe",
      phone: "+1 555",
      location: "SF",
      current_title: "Engineer",
      experience_level: "mid",
      years_experience: 5,
      skills: ["TypeScript"],
      industries: ["Tech"],
      work_experience: [
        {
          company: "Acme",
          title: "Engineer",
          start_date: "2020-01",
          end_date: null,
          is_current: true,
          responsibilities: "Built things",
        },
      ],
      education: {
        degree: "BS",
        field_of_study: "CS",
        institution: "State U",
        graduation_year: "2018",
      },
      job_titles_seeking: ["Engineer"],
      remote_preference: "remote",
      preferred_locations: ["Remote"],
      salary_expectation: "150k",
      linkedin_url: "https://linkedin.com/in/jane",
      portfolio_url: null,
      work_authorization: "citizen",
    });

    expect(parsed.full_name).toBe("Jane Doe");
    expect(parsed.skills).toEqual(["TypeScript"]);
  });

  it("rejects invalid experience_level enums", () => {
    expect(() =>
      profileExtractSchema.parse({
        full_name: null,
        phone: null,
        location: null,
        current_title: null,
        experience_level: "intern",
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
      }),
    ).toThrow();
  });

  it("rejects more than 3 work_experience roles", () => {
    const role = {
      company: "Co",
      title: "Dev",
      start_date: "2020-01",
      end_date: null,
      is_current: false,
      responsibilities: "Work",
    };
    expect(() =>
      profileExtractSchema.parse({
        full_name: null,
        phone: null,
        location: null,
        current_title: null,
        experience_level: null,
        years_experience: null,
        skills: [],
        industries: [],
        work_experience: [role, role, role, role],
        education: {},
        job_titles_seeking: [],
        remote_preference: null,
        preferred_locations: [],
        salary_expectation: null,
        linkedin_url: null,
        portfolio_url: null,
        work_authorization: null,
      }),
    ).toThrow();
  });
});

describe("normalizeHighestDegree", () => {
  it("maps common resume degrees onto Education select values", () => {
    expect(normalizeHighestDegree("B.Tech")).toBe("Bachelor");
    expect(normalizeHighestDegree("B.Tech Computer Science")).toBe("Bachelor");
    expect(normalizeHighestDegree("Bachelor of Science")).toBe("Bachelor");
    expect(normalizeHighestDegree("M.Tech")).toBe("Master");
    expect(normalizeHighestDegree("MBA")).toBe("Master");
    expect(normalizeHighestDegree("Ph.D")).toBe("PhD");
    expect(normalizeHighestDegree("High School")).toBe("High School");
    expect(normalizeHighestDegree("Diploma")).toBe("Other");
  });
});

describe("pickSocialProfileUrls", () => {
  it("reads LinkedIn/GitHub from labeled hyperlink appendix and markdown", () => {
    const text = `
Jane Doe
[LinkedIn](https://linkedin.com/in/jane-doe)
[GitHub](https://github.com/janedoe)

EXTRACTED_HYPERLINKS:
- Portfolio Website: https://jane.dev
- LinkedIn: https://linkedin.com/in/jane-doe
`;
    expect(pickSocialProfileUrls(text)).toEqual({
      linkedin_url: "https://linkedin.com/in/jane-doe",
      portfolio_url: "https://github.com/janedoe",
    });
  });

  it("uses portfolio label when GitHub is absent", () => {
    const text = `
EXTRACTED_HYPERLINKS:
- Portfolio Website: https://my-site.com
- LinkedIn: https://www.linkedin.com/in/someone
`;
    expect(pickSocialProfileUrls(text)).toEqual({
      linkedin_url: "https://www.linkedin.com/in/someone",
      portfolio_url: "https://my-site.com/",
    });
  });
});

describe("normalizeDateToYearMonth", () => {
  it("normalizes common resume date formats to YYYY-MM", () => {
    expect(normalizeDateToYearMonth("2022-01")).toBe("2022-01");
    expect(normalizeDateToYearMonth("2022-1")).toBe("2022-01");
    expect(normalizeDateToYearMonth("Jan 2022")).toBe("2022-01");
    expect(normalizeDateToYearMonth("January 2022")).toBe("2022-01");
    expect(normalizeDateToYearMonth("2022")).toBe("2022-01");
    expect(normalizeDateToYearMonth("03/2021")).toBe("2021-03");
    expect(normalizeDateToYearMonth("Present")).toBe("");
  });
});

describe("asResponsibilities", () => {
  it("joins bullet arrays into a newline string", () => {
    expect(asResponsibilities(["Built APIs", "Owned CI"])).toBe(
      "Built APIs\nOwned CI",
    );
    expect(asResponsibilities("Already a string")).toBe("Already a string");
  });
});

describe("normalizeRawExtract", () => {
  it("maps name alias to full_name and fills missing arrays", () => {
    const normalized = normalizeRawExtract({
      name: "ARYAN SRIVASTAVA",
      phone: "+91 8707 392 404",
      location: "",
      email: "ignored@example.com",
    });

    expect(normalized.full_name).toBe("ARYAN SRIVASTAVA");
    expect(normalized.phone).toBe("+91 8707 392 404");
    expect(normalized.location).toBeNull();
    expect(normalized.skills).toEqual([]);
    expect(normalized.work_experience).toEqual([]);
    expect(normalized.education).toEqual({});
  });

  it("coerces work dates and responsibility arrays for the profile UI", () => {
    const normalized = normalizeRawExtract({
      work_experience: [
        {
          company: "Acme",
          title: "Engineer",
          start_date: "Jan 2022",
          end_date: "Present",
          is_current: true,
          responsibilities: ["Shipped features", "Mentored juniors"],
        },
      ],
      education: {
        degree: "B.Tech Computer Science",
        institution: "Example University",
        graduation_year: "2021",
      },
    });

    expect(normalized.work_experience[0]).toMatchObject({
      company: "Acme",
      start_date: "2022-01",
      end_date: null,
      is_current: true,
      responsibilities: "Shipped features\nMentored juniors",
    });
    expect(normalized.education).toMatchObject({
      degree: "Bachelor",
      field_of_study: "Computer Science",
      institution: "Example University",
      graduation_year: "2021",
    });
  });

  it("parses truncated model text into a usable extract", () => {
    const parsed = parseExtractFromModelText(
      '{"phone":"+91 8707 392 404","location":"","name":"ARYAN SRIVASTAVA","email":"aryansri20011967@gmail.com"}',
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.full_name).toBe("ARYAN SRIVASTAVA");
    expect(parsed?.phone).toBe("+91 8707 392 404");
  });
});

describe("inferSalaryExpectation", () => {
  it("returns null when there is no career signal", () => {
    expect(inferSalaryExpectation(emptyExtract())).toBeNull();
  });

  it("infers an India LPA band from phone + mid stack experience", () => {
    const salary = inferSalaryExpectation(
      emptyExtract({
        phone: "+91 8707 392 404",
        location: "Bengaluru, India",
        experience_level: "mid",
        years_experience: 4,
        skills: ["React", "TypeScript", "Next.js"],
      }),
    );
    expect(salary).toBe("₹12-20 LPA");
  });
});

describe("finalizeExtract", () => {
  it("fills missing dates, responsibilities, field of study, and salary from resume text", () => {
    const resume = `
ARYAN SRIVASTAVA
Phone: +91 8707 392 404
Location: Bengaluru, India

EXPERIENCE
Software Engineer — Example Corp (Jan 2022 – Present)
- Built web apps with React and TypeScript
- Led frontend features for job search products

SKILLS
React, TypeScript, Next.js

EDUCATION
B.Tech Computer Science — Example University — 2021
`;

    const finalized = finalizeExtract(
      {
        full_name: "ARYAN SRIVASTAVA",
        phone: "+91 8707 392 404",
        location: "Bengaluru, India",
        current_title: "Software Engineer",
        experience_level: "mid",
        years_experience: 4,
        skills: ["React", "TypeScript"],
        work_experience: [
          {
            company: "Example Corp",
            title: "Software Engineer",
            start_date: "",
            end_date: null,
            is_current: true,
            responsibilities: "",
          },
        ],
        education: { degree: "B.Tech Computer Science" },
        salary_expectation: null,
      },
      resume,
    );

    expect(finalized.work_experience[0]?.start_date).toBe("2022-01");
    expect(finalized.work_experience[0]?.responsibilities).toContain(
      "Built web apps",
    );
    expect(finalized.education.field_of_study).toBe("Computer Science");
    expect(finalized.education.degree).toBe("Bachelor");
    expect(finalized.salary_expectation).toMatch(/LPA/);
  });

  it("fills LinkedIn and GitHub from EXTRACTED_HYPERLINKS when model omits them", () => {
    const resume = `
Name: Jane
EXTRACTED_HYPERLINKS:
- LinkedIn: https://linkedin.com/in/jane
- GitHub: https://github.com/jane
`;
    const finalized = finalizeExtract(
      {
        full_name: "Jane",
        linkedin_url: null,
        portfolio_url: null,
        skills: ["React"],
        location: "India",
        phone: "+91 9999999999",
      },
      resume,
    );
    expect(finalized.linkedin_url).toBe("https://linkedin.com/in/jane");
    expect(finalized.portfolio_url).toBe("https://github.com/jane");
  });
});

describe("clearProfileFormFields", () => {
  it("clears editable fields but keeps resume and identity metadata", () => {
    const cleared = clearProfileFormFields({
      ...MOCK_PROFILE,
      resume_pdf_url: "user-1/resume.pdf",
      email: "keep@example.com",
      id: "user-1",
    });

    expect(cleared.resume_pdf_url).toBe("user-1/resume.pdf");
    expect(cleared.email).toBe("keep@example.com");
    expect(cleared.id).toBe("user-1");
    expect(cleared.full_name).toBeNull();
    expect(cleared.skills).toEqual([]);
    expect(cleared.work_experience).toEqual([]);
    expect(cleared.education).toEqual({});
    expect(cleared.linkedin_url).toBeNull();
    expect(cleared.portfolio_url).toBeNull();
    expect(cleared.created_at).toBe(MOCK_PROFILE.created_at);
  });
});

describe("hasSubstantiveExtractFields / hasHeuristicExtractFields", () => {
  it("does not treat salary-only extracts as substantive", () => {
    const salaryOnly = emptyExtract({
      salary_expectation: "₹12-20 LPA",
      experience_level: "mid",
      years_experience: 4,
    });

    expect(hasSubstantiveExtractFields(salaryOnly)).toBe(false);
    expect(hasHeuristicExtractFields(salaryOnly)).toBe(false);
  });

  it("counts portfolio_url as substantive", () => {
    const withPortfolio = emptyExtract({
      portfolio_url: "https://github.com/jane",
    });

    expect(hasSubstantiveExtractFields(withPortfolio)).toBe(true);
    expect(hasHeuristicExtractFields(withPortfolio)).toBe(true);
  });
});

describe("mergeExtractedIntoProfile", () => {
  it("fills extracted fields without overwriting identity or resume metadata", () => {
    const base = {
      ...MOCK_PROFILE,
      email: "auth@example.com",
      resume_pdf_url: "https://example.com/resume.pdf",
      is_complete: false,
      id: "user-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };

    const merged = mergeExtractedIntoProfile(base, {
      full_name: "Extracted Name",
      phone: "555-0100",
      location: "Austin, TX",
      current_title: "Senior Engineer",
      experience_level: "senior",
      years_experience: 8,
      skills: ["Go", "Rust"],
      industries: ["Fintech"],
      work_experience: [
        {
          company: "Bank",
          title: "Senior Engineer",
          start_date: "2021-06",
          end_date: null,
          is_current: true,
          responsibilities: "Led platform work",
        },
      ],
      education: {
        degree: "MS",
        field_of_study: "CS",
        institution: "MIT",
        graduation_year: "2016",
      },
      job_titles_seeking: ["Staff Engineer"],
      remote_preference: "hybrid",
      preferred_locations: ["Austin"],
      salary_expectation: "200k",
      linkedin_url: "https://linkedin.com/in/extracted",
      portfolio_url: "https://example.dev",
      work_authorization: "permanent_resident",
    });

    expect(merged.id).toBe("user-1");
    expect(merged.email).toBe("auth@example.com");
    expect(merged.resume_pdf_url).toBe("https://example.com/resume.pdf");
    expect(merged.is_complete).toBe(false);
    expect(merged.created_at).toBe(base.created_at);
    expect(merged.updated_at).toBe(base.updated_at);
    expect(merged.cover_letter_tone).toBe(base.cover_letter_tone);

    expect(merged.full_name).toBe("Extracted Name");
    expect(merged.phone).toBe("555-0100");
    expect(merged.skills).toEqual(["Go", "Rust"]);
    expect(merged.work_experience).toHaveLength(1);
    expect(merged.education.institution).toBe("MIT");
  });

  it("keeps existing values when extracted strings are empty", () => {
    const base = {
      ...MOCK_PROFILE,
      full_name: "Keep Me",
      phone: "111",
      skills: ["React"],
    };

    const merged = mergeExtractedIntoProfile(base, {
      full_name: "",
      phone: "   ",
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
    });

    expect(merged.full_name).toBe("Keep Me");
    expect(merged.phone).toBe("111");
    expect(merged.skills).toEqual(["React"]);
  });

  it("replaces array fields when extraction returns non-empty arrays", () => {
    const merged = mergeExtractedIntoProfile(MOCK_PROFILE, {
      full_name: MOCK_PROFILE.full_name,
      phone: null,
      location: null,
      current_title: null,
      experience_level: null,
      years_experience: null,
      skills: ["Python"],
      industries: ["Healthcare"],
      work_experience: [],
      education: {},
      job_titles_seeking: ["Backend"],
      remote_preference: null,
      preferred_locations: ["NYC"],
      salary_expectation: null,
      linkedin_url: null,
      portfolio_url: null,
      work_authorization: null,
    });

    expect(merged.skills).toEqual(["Python"]);
    expect(merged.industries).toEqual(["Healthcare"]);
    expect(merged.job_titles_seeking).toEqual(["Backend"]);
    expect(merged.preferred_locations).toEqual(["NYC"]);
    expect(merged.work_experience).toEqual(MOCK_PROFILE.work_experience);
  });
});
