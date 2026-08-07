/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
    displayCompany,
    displayLocation,
    displaySalary,
    displayTitle,
    formatJobType,
    getApplyUrl,
    getMatchBadgeClass,
    mapDbRowToJob,
    stripHtmlToText,
} from "@/lib/job-detail";
import type { CompanyResearch } from "@/types";

const baseRow = {
  id: "job-1",
  run_id: "run-1",
  user_id: "user-1",
  source: "search",
  source_url: "https://adzuna.example/job",
  external_apply_url: "https://employer.example/apply",
  title: "Backend Developer",
  company: "Insight Global",
  location: "Newark, Essex",
  salary: "$101k – $101k",
  job_type: "fulltime",
  about_role: "<p>Build APIs with <b>Node.js</b></p>",
  responsibilities: null,
  requirements: ["5+ years"],
  nice_to_have: null,
  benefits: [],
  about_company: null,
  match_score: 85.4,
  match_reason: "Strong Node.js match",
  matched_skills: ["Node.js", "AWS"],
  missing_skills: ["Java (Spring Boot)"],
  company_research: null,
  found_at: "2026-08-02T10:00:00.000Z",
};

describe("formatJobType", () => {
  it("humanizes common Adzuna contract types", () => {
    expect(formatJobType("fulltime")).toBe("Full-time");
    expect(formatJobType("part_time")).toBe("Part-time");
    expect(formatJobType("contract")).toBe("Contract");
  });

  it("returns em dash for empty values", () => {
    expect(formatJobType(null)).toBe("—");
    expect(formatJobType("")).toBe("—");
    expect(formatJobType("   ")).toBe("—");
  });

  it("title-cases unknown values", () => {
    expect(formatJobType("internship")).toBe("Internship");
  });
});

describe("stripHtmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(stripHtmlToText("<p>Hello &amp; <b>world</b></p>")).toBe(
      "Hello & world",
    );
  });

  it("returns empty string for null/empty", () => {
    expect(stripHtmlToText(null)).toBe("");
    expect(stripHtmlToText("")).toBe("");
  });

  it("collapses whitespace", () => {
    expect(stripHtmlToText("<p>One</p>\n\n<p>Two</p>")).toBe("One Two");
  });
});

describe("getApplyUrl", () => {
  it("prefers external_apply_url", () => {
    expect(
      getApplyUrl({
        external_apply_url: "https://apply.example",
        source_url: "https://source.example",
      }),
    ).toBe("https://apply.example");
  });

  it("falls back to source_url", () => {
    expect(
      getApplyUrl({
        external_apply_url: null,
        source_url: "https://source.example",
      }),
    ).toBe("https://source.example");
  });

  it("returns null when both missing", () => {
    expect(
      getApplyUrl({ external_apply_url: "  ", source_url: null }),
    ).toBeNull();
  });

  it("rejects non-http(s) URLs", () => {
    expect(
      getApplyUrl({
        external_apply_url: "javascript:alert(1)",
        source_url: "https://safe.example",
      }),
    ).toBe("https://safe.example");
    expect(
      getApplyUrl({
        external_apply_url: "javascript:alert(1)",
        source_url: "data:text/html,hi",
      }),
    ).toBeNull();
  });
});

describe("getMatchBadgeClass", () => {
  it("uses success styling for high matches (PNG)", () => {
    expect(getMatchBadgeClass(85)).toContain("success");
    expect(getMatchBadgeClass(70)).toContain("success");
  });

  it("uses warning text for lower scores", () => {
    expect(getMatchBadgeClass(55)).toContain("text-warning");
  });
});

describe("mapDbRowToJob", () => {
  it("maps a full row with normalized arrays and clamped score", () => {
    const job = mapDbRowToJob(baseRow);
    expect(job.id).toBe("job-1");
    expect(job.source).toBe("search");
    expect(job.match_score).toBe(85);
    expect(job.responsibilities).toEqual([]);
    expect(job.requirements).toEqual(["5+ years"]);
    expect(job.nice_to_have).toEqual([]);
    expect(job.benefits).toEqual([]);
    expect(job.matched_skills).toEqual(["Node.js", "AWS"]);
    expect(job.missing_skills).toEqual(["Java (Spring Boot)"]);
    expect(job.company_research).toBeNull();
    expect(job.researched_at).toBeNull();
  });

  it("defaults invalid source and null skills", () => {
    const job = mapDbRowToJob({
      ...baseRow,
      source: "unknown",
      matched_skills: null,
      missing_skills: undefined,
      match_score: null,
      run_id: null,
    });
    expect(job.source).toBe("search");
    expect(job.matched_skills).toEqual([]);
    expect(job.missing_skills).toEqual([]);
    expect(job.match_score).toBeNull();
    expect(job.run_id).toBeNull();
  });

  it("parses company_research dossier when present", () => {
    const dossier: CompanyResearch = {
      companyOverview: "Staffing firm",
      techStack: ["Node"],
      culture: ["Fast"],
      whyThisRole: "Growth",
      yourEdge: ["APIs"],
      gapsToAddress: ["Java"],
      smartQuestions: ["Scale?"],
      interviewPrep: ["System design"],
      sources: ["https://example.com", "javascript:alert(1)"],
    };
    const job = mapDbRowToJob({
      ...baseRow,
      company_research: dossier,
    });
    expect(job.company_research).toEqual({
      ...dossier,
      sources: ["https://example.com"],
    });
  });

  it("display helpers fall back to em dash or labels", () => {
    expect(displaySalary(null)).toBe("—");
    expect(displayLocation("  ")).toBe("—");
    expect(displayCompany(null)).toBe("Unknown company");
    expect(displayTitle("")).toBe("Untitled role");
    expect(displaySalary("$120k")).toBe("$120k");
  });
});
