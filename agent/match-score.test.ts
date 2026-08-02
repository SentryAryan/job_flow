import { describe, expect, it, vi } from "vitest";

import {
    alignMatchScores,
    buildMatchScoreUserPrompt,
    extractModelTextFromError,
    fallbackMatchScore,
    healJobMatchScoresFromText,
    MATCH_SCORE_SYSTEM_PROMPT,
} from "@/agent/match-score";
import type { AdzunaJob } from "@/lib/adzuna";
import type { Profile } from "@/types";

const job = (overrides: Partial<AdzunaJob> = {}): AdzunaJob => ({
  id: "1",
  title: "React Engineer",
  company: { display_name: "Acme" },
  location: { display_name: "Remote" },
  description: "Build UI with React and TypeScript",
  redirect_url: "https://example.com",
  salary_is_predicted: "1",
  created: "2026-07-01T00:00:00Z",
  category: { tag: "it-jobs", label: "IT" },
  ...overrides,
});

const profile = {
  id: "u1",
  full_name: "Ada",
  email: "a@b.com",
  phone: null,
  location: null,
  current_title: "Frontend Engineer",
  experience_level: "mid",
  years_experience: 4,
  skills: ["React", "TypeScript", "Node"],
  industries: ["SaaS"],
  work_experience: [],
  education: {},
  job_titles_seeking: ["Frontend Engineer"],
  remote_preference: "remote",
  preferred_locations: [],
  salary_expectation: null,
  cover_letter_tone: null,
  linkedin_url: null,
  portfolio_url: null,
  work_authorization: null,
  resume_pdf_url: null,
  is_complete: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} satisfies Profile;

describe("fallbackMatchScore", () => {
  it("boosts score when profile skills appear in the job text", () => {
    const scored = fallbackMatchScore(job(), ["React", "TypeScript"]);
    expect(scored.matchScore).toBeGreaterThanOrEqual(50);
    expect(scored.matchedSkills).toEqual(
      expect.arrayContaining(["React", "TypeScript"]),
    );
  });
});

describe("alignMatchScores", () => {
  it("fills missing indices with fallbacks", () => {
    const jobs = [job({ id: "a" }), job({ id: "b", title: "Go Engineer" })];
    const aligned = alignMatchScores(
      jobs,
      {
        scores: [
          {
            index: 0,
            matchScore: 88,
            matchReason: "Strong React overlap",
            matchedSkills: ["React"],
            missingSkills: ["GraphQL"],
          },
        ],
      },
      ["React"],
    );

    expect(aligned).toHaveLength(2);
    expect(aligned[0]?.matchScore).toBe(88);
    expect(aligned[1]?.matchScore).toBeGreaterThanOrEqual(35);
  });
});

describe("buildMatchScoreUserPrompt", () => {
  it("includes profile skills and job indices with short descriptions", () => {
    const longDesc = "x".repeat(2000);
    const prompt = buildMatchScoreUserPrompt(profile, [
      job({ description: longDesc }),
    ]);
    expect(prompt).toContain("React");
    expect(prompt).toContain('"index":0');
    expect(prompt).toContain('{"scores"');
    expect(prompt).not.toContain("x".repeat(700));
  });
});

describe("MATCH_SCORE_SYSTEM_PROMPT", () => {
  it("forbids markdown fences and bare arrays", () => {
    expect(MATCH_SCORE_SYSTEM_PROMPT).toMatch(/No markdown fences/i);
    expect(MATCH_SCORE_SYSTEM_PROMPT).toMatch(/never a bare array/i);
  });

  it("is sector-agnostic (not IT-only)", () => {
    expect(MATCH_SCORE_SYSTEM_PROMPT).toMatch(/any industry|any sector/i);
    expect(MATCH_SCORE_SYSTEM_PROMPT).not.toMatch(/IT\/tech job listings/i);
  });
});

describe("healJobMatchScoresFromText", () => {
  it("parses fenced object JSON", () => {
    const text = `\`\`\`json
{"scores":[{"index":0,"matchScore":70,"matchReason":"Ok","matchedSkills":["React"],"missingSkills":[]}]}
\`\`\``;
    const healed = healJobMatchScoresFromText(text);
    expect(healed?.scores).toHaveLength(1);
    expect(healed?.scores[0]?.matchScore).toBe(70);
  });

  it("wraps a bare array root", () => {
    const text = `\`\`\`json
[
  {"index":0,"matchScore":25,"matchReason":"Weak","matchedSkills":["AWS"],"missingSkills":["CMS"]},
  {"index":1,"matchScore":75,"matchReason":"Strong","matchedSkills":["React"],"missingSkills":[]}
]
\`\`\``;
    const healed = healJobMatchScoresFromText(text);
    expect(healed?.scores).toHaveLength(2);
    expect(healed?.scores[1]?.matchScore).toBe(75);
  });

  it("recovers truncated array mid-object", () => {
    const text = `\`\`\`json
[
  {"index":0,"matchScore":25,"matchReason":"Weak","matchedSkills":["AWS"],"missingSkills":["CMS"]},
  {"index":1,"matchScore":75,"matchReason":"Strong","matchedSkills":["React"],"missingSkills":[]},
  {"index":2,"matchScore":10,"matchReason":"Junior","matchedSkills":["Java"],"missingSkills":[
    "TS/SCI clearance",
    "Security clearance`;
    const healed = healJobMatchScoresFromText(text);
    expect(healed).not.toBeNull();
    expect(healed!.scores.length).toBeGreaterThanOrEqual(2);
    expect(healed!.scores.map((s) => s.index)).toEqual(
      expect.arrayContaining([0, 1]),
    );
  });

  it("returns null for unusable text", () => {
    expect(healJobMatchScoresFromText("not json at all")).toBeNull();
  });

  it("aligns healed partial scores onto all jobs", () => {
    const jobs = [job({ id: "a" }), job({ id: "b" }), job({ id: "c" })];
    const healed = healJobMatchScoresFromText(
      JSON.stringify([
        {
          index: 0,
          matchScore: 80,
          matchReason: "Good",
          matchedSkills: ["React"],
          missingSkills: [],
        },
      ]),
    );
    expect(healed).not.toBeNull();
    const aligned = alignMatchScores(jobs, healed!, profile.skills);
    expect(aligned).toHaveLength(3);
    expect(aligned[0]?.matchScore).toBe(80);
    expect(aligned[2]?.matchScore).toBeGreaterThanOrEqual(35);
  });
});

describe("extractModelTextFromError", () => {
  it("reads text from NoObjectGenerated-style errors", () => {
    const err = Object.assign(new Error("No object generated"), {
      text: '[{"index":0,"matchScore":50,"matchReason":"x","matchedSkills":[],"missingSkills":[]}]',
    });
    expect(extractModelTextFromError(err)).toContain("matchScore");
  });

  it("returns null when text is missing", () => {
    expect(extractModelTextFromError(new Error("boom"))).toBeNull();
  });
});

describe("scoreJobsAgainstProfile heal path", () => {
  it("heals from generateObject text on failure", async () => {
    vi.resetModules();
    vi.doMock("ai", () => ({
      generateObject: vi.fn(async () => {
        throw Object.assign(new Error("No object generated"), {
          text: `\`\`\`json
[{"index":0,"matchScore":66,"matchReason":"Healed","matchedSkills":["React"],"missingSkills":[]}]
\`\`\``,
        });
      }),
    }));
    vi.doMock("@/lib/ai/provider", () => ({
      withOpenRouterKeyFailover: async (
        fn: (model: unknown) => Promise<unknown>,
      ) => fn({}),
    }));

    const { scoreJobsAgainstProfile } = await import("@/agent/adzuna");
    const scores = await scoreJobsAgainstProfile(profile, [job()]);
    expect(scores).toHaveLength(1);
    expect(scores[0]?.matchScore).toBe(66);
    expect(scores[0]?.matchReason).toBe("Healed");
  });
});
