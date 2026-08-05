import { describe, expect, it, vi } from "vitest";

import { researchCompany } from "@/agent/research";
import {
    emptyDossierFallback,
    healCompanyResearchFromText,
    isHomepageExtractThin,
    pickSubPageLinks,
} from "@/agent/research-schemas";
import { ResearchLlmMeter } from "@/lib/research-llm-meter";
import type { CompanyResearch, Profile } from "@/types";

const MOCK_PROFILE: Profile = {
  id: "user-1",
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: null,
  location: null,
  current_title: "Engineer",
  experience_level: "senior",
  years_experience: 5,
  skills: ["TypeScript", "React"],
  industries: ["tech"],
  work_experience: [],
  education: {},
  job_titles_seeking: [],
  remote_preference: null,
  preferred_locations: [],
  salary_expectation: null,
  cover_letter_tone: null,
  linkedin_url: null,
  portfolio_url: null,
  work_authorization: null,
  resume_pdf_url: null,
  is_complete: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_RESEARCH: CompanyResearch = {
  companyOverview: "Builds payments infrastructure.",
  techStack: ["Ruby", "React"],
  culture: ["Customer-obsessed"],
  whyThisRole: "Grow the dashboard product.",
  yourEdge: ["Strong React background"],
  gapsToAddress: ["Learn more about payments domain"],
  smartQuestions: ["How is success measured?"],
  interviewPrep: ["Review Stripe API basics"],
  sources: ["https://stripe.com"],
};

const ALTERNATE_SHAPE_JSON = `{
  "company": "Amazon",
  "role": "Frontend Engineer, Kiro",
  "candidate": {
    "title": "Full Stack Web Developer",
    "experience": "1 year, junior",
    "skills": ["JavaScript", "TypeScript", "React"]
  },
  "strengths": [
    "Proficient in React, Next.js, and TypeScript."
  ],
  "weaknesses": [
    "Limited exposure to C#."
  ],
  "strategies": [
    "Frame the C# gap as a learning opportunity."
  ],
  "talkingPoints": [
    "Highlight use of Tailwind CSS and shadcn/ui."
  ],
  "questions": [
    "Which AWS services are central to Kiro's workflow?"
  ]
}`;

function createClientMock(overrides?: {
  job?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  updateError?: unknown;
}) {
  const job = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "user-1",
    title: "Engineer",
    company: "Stripe",
    about_role: "Build UI",
    matched_skills: ["React"],
    missing_skills: ["Ruby"],
    responsibilities: [],
    requirements: [],
    nice_to_have: [],
    benefits: [],
    found_at: new Date().toISOString(),
    ...overrides?.job,
  };

  const update = vi.fn(() => ({
    eq: () => ({
      eq: async () => ({ error: overrides?.updateError ?? null }),
    }),
  }));

  return {
    database: {
      from: (table: string) => {
        if (table === "jobs") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: job, error: null }),
                }),
              }),
            }),
            update,
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: overrides?.profile ?? MOCK_PROFILE,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "agent_logs") {
          return {
            insert: async () => ({ error: null }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    },
    _update: update,
  };
}

describe("pickSubPageLinks", () => {
  it("prefers about/careers/team/engineering/blog over product", () => {
    const picked = pickSubPageLinks(
      [
        { url: "https://x.com/product", kind: "product" },
        { url: "https://x.com/about", kind: "about" },
        { url: "https://x.com/careers", kind: "careers" },
        { url: "https://x.com/blog", kind: "blog" },
      ],
      2,
    );
    expect(picked.map((l) => l.kind)).toEqual(["about", "careers"]);
  });

  it("defaults to a single sub-page", () => {
    const picked = pickSubPageLinks([
      { url: "https://x.com/about", kind: "about" },
      { url: "https://x.com/careers", kind: "careers" },
    ]);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.kind).toBe("about");
  });
});

describe("isHomepageExtractThin", () => {
  it("detects empty oneLiner and productSummary", () => {
    expect(
      isHomepageExtractThin({
        oneLiner: "",
        productSummary: "  ",
        signals: [],
        pageLinks: [],
      }),
    ).toBe(true);
  });
});

describe("healCompanyResearchFromText", () => {
  it("maps alternate free-model shape onto dossier fields", () => {
    const healed = healCompanyResearchFromText(
      ALTERNATE_SHAPE_JSON,
      ["https://www.amazon.com"],
      {
        job: {
          title: "Frontend Engineer, Kiro",
          company: "Amazon",
          about_role: "Build Kiro UI",
          matched_skills: ["React", "TypeScript"],
        },
      },
    );

    expect(healed).not.toBeNull();
    expect(healed!.companyOverview).toMatch(/Amazon/i);
    expect(healed!.yourEdge[0]).toMatch(/React/i);
    expect(healed!.gapsToAddress.length).toBeGreaterThanOrEqual(2);
    expect(healed!.smartQuestions[0]).toMatch(/AWS/i);
    expect(healed!.interviewPrep[0]).toMatch(/Tailwind/i);
    expect(healed!.sources).toEqual(["https://www.amazon.com"]);
    expect(healed!.techStack).toEqual(
      expect.arrayContaining(["React", "TypeScript"]),
    );
  });

  it("returns null for unusable text", () => {
    expect(
      healCompanyResearchFromText("not json at all", ["https://x.com"]),
    ).toBeNull();
  });
});

describe("emptyDossierFallback", () => {
  it("uses matched and missing skills when job + profile provided", () => {
    const dossier = emptyDossierFallback({
      company: "Stripe",
      sources: ["https://stripe.com"],
      job: {
        title: "Engineer",
        company: "Stripe",
        about_role: "Build UI",
        matched_skills: ["React"],
        missing_skills: ["Ruby"],
      },
      profile: { current_title: "Engineer", skills: ["TypeScript", "React"] },
    });

    expect(dossier.techStack).toContain("React");
    expect(dossier.yourEdge[0]).toMatch(/React/);
    expect(dossier.gapsToAddress[0]).toMatch(/Ruby/);
    expect(dossier.smartQuestions[0]).toMatch(/Stripe/);
  });
});

describe("researchCompany", () => {
  it("synthesizes without browse when homepage is thin and records all LLM hits once", async () => {
    const client = createClientMock();
    const recordLlmHits = vi.fn();
    const goto = vi.fn();
    const extract = vi.fn().mockResolvedValueOnce({
      oneLiner: "",
      productSummary: "",
      signals: [],
      pageLinks: [],
    });

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://stripe.com",
        resolvedJobPageUrl: null,
        source: "company_fallback",
      }),
      createSession: async () => ({ id: "sess-1" }),
      createStagehand: async () => ({
        stagehand: {
          context: { activePage: () => ({ goto }) },
          extract,
          close: vi.fn(),
        } as never,
        consumeLlmCallCount: () => 2,
      }),
      synthesize: async () => MOCK_RESEARCH,
      rateLimit: {
        canUseExtraExtract: async () => true,
        recordLlmHits,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.browsed).toBe(false);
      expect(result.degraded).toBe(false);
      expect(result.research).toEqual(MOCK_RESEARCH);
      expect(result.llmCalls).toBe(5);
    }
    // Fixed Redis charge of 5 per admitted research (meter drained separately).
    expect(recordLlmHits).toHaveBeenCalledTimes(1);
    expect(recordLlmHits).toHaveBeenCalledWith(5);
    expect(client._update).toHaveBeenCalled();
  });

  it("skips further extracts when canUseExtraExtract is false after homepage", async () => {
    const client = createClientMock();
    let extractGate = 0;
    const extract = vi.fn().mockResolvedValue({
      oneLiner: "Payments",
      productSummary: "APIs for money",
      signals: [],
      pageLinks: [
        { url: "https://stripe.com/about", kind: "about" },
        { url: "https://stripe.com/blog", kind: "blog" },
      ],
    });

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://stripe.com",
        resolvedJobPageUrl: null,
        source: "redirect",
      }),
      createSession: async () => ({ id: "sess-1" }),
      createStagehand: async () => ({
        stagehand: {
          context: { activePage: () => ({ goto: vi.fn() }) },
          extract,
          close: vi.fn(),
        } as never,
        consumeLlmCallCount: () => 2,
      }),
      synthesize: async () => MOCK_RESEARCH,
      rateLimit: {
        canUseExtraExtract: async () => {
          extractGate += 1;
          return extractGate <= 1;
        },
        recordLlmHits: async () => undefined,
      },
    });

    expect(result.success).toBe(true);
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("still saves richer fallback dossier when synthesis throws", async () => {
    const client = createClientMock();
    const recordLlmHits = vi.fn();

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://stripe.com",
        resolvedJobPageUrl: null,
        source: "company_fallback",
      }),
      createSession: async () => {
        throw new Error("no browser");
      },
      createStagehand: async () => {
        throw new Error("no stagehand");
      },
      synthesize: async () => {
        throw new Error("model down");
      },
      rateLimit: {
        recordLlmHits,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.degraded).toBe(true);
      expect(result.research.companyOverview).toMatch(/Limited public research/i);
      expect(result.research.yourEdge[0]).toMatch(/React/);
      expect(result.research.gapsToAddress[0]).toMatch(/Ruby/);
      expect(result.llmCalls).toBe(5);
    }
    expect(recordLlmHits).toHaveBeenCalledWith(5);
  });

  it("meters live onLlmCall without double-counting consume fallback", async () => {
    const client = createClientMock();
    const recordLlmHits = vi.fn();
    let localCount = 0;

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://stripe.com",
        resolvedJobPageUrl: null,
        source: "company_fallback",
      }),
      createSession: async () => ({ id: "sess-1" }),
      createStagehand: async (opts) => ({
        stagehand: {
          context: { activePage: () => ({ goto: vi.fn() }) },
          extract: vi.fn().mockImplementation(async () => {
            opts.onLlmCall?.();
            opts.onLlmCall?.();
            localCount += 2;
            return {
              oneLiner: "",
              productSummary: "",
              signals: [],
              pageLinks: [],
            };
          }),
          close: vi.fn(),
        } as never,
        consumeLlmCallCount: () => {
          const n = localCount;
          localCount = 0;
          return n;
        },
      }),
      synthesize: async () => MOCK_RESEARCH,
      rateLimit: { recordLlmHits },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.llmCalls).toBe(5);
    }
    expect(recordLlmHits).toHaveBeenCalledWith(5);
  });

  it("skips AI synthesis when canUseSynthesis is false", async () => {
    const client = createClientMock();
    const recordLlmHits = vi.fn();
    const synthesize = vi.fn(async () => MOCK_RESEARCH);

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://stripe.com",
        resolvedJobPageUrl: null,
        source: "company_fallback",
      }),
      createSession: async () => {
        throw new Error("skip browse");
      },
      createStagehand: async () => {
        throw new Error("skip browse");
      },
      synthesize,
      rateLimit: {
        canUseSynthesis: async () => false,
        recordLlmHits,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.degraded).toBe(true);
      expect(result.research.companyOverview).toMatch(/Limited public research/i);
      expect(result.llmCalls).toBe(5);
    }
    expect(synthesize).not.toHaveBeenCalled();
    expect(recordLlmHits).toHaveBeenCalledWith(5);
  });

  it("skips homepage extract on Chrome SSL error page", async () => {
    const client = createClientMock();
    const extract = vi.fn();
    const goto = vi.fn();

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://www.ableforce.com/",
        resolvedJobPageUrl: null,
        source: "redirect",
      }),
      createSession: async () => ({ id: "sess-1" }),
      createStagehand: async () => ({
        stagehand: {
          context: {
            activePage: () => ({
              goto,
              url: () => "https://www.ableforce.com/",
              title: async () => "This site can’t be reached",
              evaluate: async () =>
                "ERR_SSL_UNRECOGNIZED_NAME_ALERT The webpage might be down",
            }),
          },
          extract,
          close: vi.fn(),
        } as never,
        consumeLlmCallCount: () => 0,
      }),
      synthesize: async () => MOCK_RESEARCH,
      rateLimit: { recordLlmHits: async () => undefined },
    });

    expect(result.success).toBe(true);
    expect(extract).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.browsed).toBe(false);
      expect(result.degraded).toBe(false);
      expect(result.research).toEqual(MOCK_RESEARCH);
    }
  });

  it("skips extract on Access Denied / Sign In sub-pages", async () => {
    const client = createClientMock();
    let gotoCount = 0;
    const extract = vi.fn().mockResolvedValue({
      oneLiner: "Furniture",
      productSummary: "Design-led homeware",
      signals: [],
      pageLinks: [{ url: "https://www.made.com/about", kind: "about" }],
    });

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://www.made.com/",
        resolvedJobPageUrl: null,
        source: "redirect",
      }),
      createSession: async () => ({ id: "sess-1" }),
      createStagehand: async () => ({
        stagehand: {
          context: {
            activePage: () => ({
              goto: vi.fn(async () => {
                gotoCount += 1;
              }),
              url: () =>
                gotoCount <= 1
                  ? "https://www.made.com/"
                  : "https://www.made.com/about",
              title: async () =>
                gotoCount <= 1 ? "MADE.com" : "Access Denied",
              evaluate: async () =>
                gotoCount <= 1
                  ? "Design furniture"
                  : "You don't have permission to access this page.",
            }),
          },
          extract,
          close: vi.fn(),
        } as never,
        consumeLlmCallCount: () => 2,
      }),
      synthesize: async () => MOCK_RESEARCH,
      rateLimit: { recordLlmHits: async () => undefined },
    });

    expect(result.success).toBe(true);
    // Homepage extract only — Access Denied sub-page skipped
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("retries sub-page extract once on timeout then uses it in dossier", async () => {
    const client = createClientMock();
    let gotoCount = 0;
    const extract = vi
      .fn()
      .mockResolvedValueOnce({
        oneLiner: "Furniture company for modern homes",
        productSummary: "Design-led homeware for apartments and houses",
        signals: ["Series A", "EU retail"],
        pageLinks: [{ url: "https://www.made.com/about", kind: "about" }],
      })
      .mockRejectedValueOnce(
        new Error(
          "Company sub-page extract timed out (https://www.made.com/about)",
        ),
      )
      .mockResolvedValueOnce({
        keyPoints: ["Customer-obsessed product teams"],
        technologies: ["React"],
        valuesOrCulture: ["Design craft"],
        notable: ["EU expansion"],
      });

    const synthesize = vi.fn(async (input: { companyResearch: unknown }) => {
      const payload = input.companyResearch as {
        pages: Array<{ url: string }>;
      };
      expect(payload.pages).toEqual([
        expect.objectContaining({ url: "https://www.made.com/about" }),
      ]);
      return MOCK_RESEARCH;
    });

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      deriveHomepage: async () => ({
        homepageUrl: "https://www.made.com/",
        resolvedJobPageUrl: null,
        source: "redirect",
      }),
      createSession: async () => ({ id: "sess-1" }),
      createStagehand: async () => ({
        stagehand: {
          context: {
            activePage: () => ({
              goto: vi.fn(async () => {
                gotoCount += 1;
              }),
              url: () =>
                gotoCount <= 1
                  ? "https://www.made.com/"
                  : "https://www.made.com/about",
              title: async () =>
                gotoCount <= 1 ? "MADE.com" : "About MADE",
              evaluate: async () =>
                gotoCount <= 1
                  ? "Design furniture for modern living"
                  : "About our company and culture",
            }),
          },
          extract,
          close: vi.fn(),
        } as never,
        consumeLlmCallCount: () => 4,
      }),
      synthesize,
      rateLimit: { recordLlmHits: async () => undefined },
    });

    expect(result.success).toBe(true);
    expect(extract).toHaveBeenCalledTimes(3);
    expect(synthesize).toHaveBeenCalled();
  });

  it("stops further Stagehand extracts once meter is at the OpenRouter cap", async () => {
    const client = createClientMock();
    const meter = new ResearchLlmMeter();
    meter.increment(5);
    const extract = vi.fn();

    const result = await researchCompany({
      userId: "user-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client: client as never,
      openRouterApiKey: "sk-test",
      llmMeter: meter,
      deriveHomepage: async () => ({
        homepageUrl: "https://stripe.com",
        resolvedJobPageUrl: null,
        source: "company_fallback",
      }),
      createSession: async () => ({ id: "sess-1" }),
      createStagehand: async () => ({
        stagehand: {
          context: { activePage: () => ({ goto: vi.fn() }) },
          extract,
          close: vi.fn(),
        } as never,
        consumeLlmCallCount: () => 0,
      }),
      synthesize: async () => MOCK_RESEARCH,
      rateLimit: { recordLlmHits: async () => undefined },
    });

    expect(result.success).toBe(true);
    expect(extract).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.browsed).toBe(false);
      // Meter already at cap → synthesis skipped → degraded fallback
      expect(result.degraded).toBe(true);
    }
  });

  it("returns degraded dossier when overall research times out", async () => {
    const prev = process.env.RESEARCH_OVERALL_TIMEOUT_MS;
    process.env.RESEARCH_OVERALL_TIMEOUT_MS = "40";
    const client = createClientMock();

    try {
      const result = await researchCompany({
        userId: "user-1",
        jobId: "11111111-1111-4111-8111-111111111111",
        client: client as never,
        openRouterApiKey: "sk-test",
        deriveHomepage: async () => ({
          homepageUrl: "https://stripe.com",
          resolvedJobPageUrl: null,
          source: "company_fallback",
        }),
        // Slow enough to trip overall timeout, but settles so Vitest can exit.
        createSession: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { id: "sess-late" };
        },
        createStagehand: async () => ({
          stagehand: {
            context: { activePage: () => ({ goto: vi.fn() }) },
            extract: vi.fn(),
            close: vi.fn(),
          } as never,
          consumeLlmCallCount: () => 0,
        }),
        synthesize: async () => MOCK_RESEARCH,
        rateLimit: { recordLlmHits: async () => undefined },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.degraded).toBe(true);
        expect(result.browsed).toBe(false);
        expect(result.research.companyOverview).toMatch(
          /Limited public research/i,
        );
      }
      expect(client._update).toHaveBeenCalled();
      // Let orphaned browse settle after overall timeout.
      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      if (prev === undefined) {
        delete process.env.RESEARCH_OVERALL_TIMEOUT_MS;
      } else {
        process.env.RESEARCH_OVERALL_TIMEOUT_MS = prev;
      }
    }
  });
});
