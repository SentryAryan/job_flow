import { z } from "zod";

import type { CompanyResearch, Job, Profile } from "@/types";

export const homepageExtractSchema = z.object({
  oneLiner: z.string().describe("What the company does in one sentence"),
  productSummary: z
    .string()
    .describe("What they build/sell and who it's for"),
  signals: z
    .array(z.string())
    .describe("Funding, notable customers, scale, mission, recent news"),
  pageLinks: z
    .array(
      z.object({
        // Stagehand only ID→URL-injects fields it detects as URL
        // (Zod 4 `z.string().url()` / `z.url()` → format "url").
        url: z.url(),
        kind: z.enum([
          "about",
          "careers",
          "blog",
          "engineering",
          "product",
          "team",
          "other",
        ]),
      }),
    )
    .describe("Internal links worth visiting"),
});

export type HomepageExtract = z.infer<typeof homepageExtractSchema>;

export const subPageExtractSchema = z.object({
  keyPoints: z.array(z.string()),
  technologies: z
    .array(z.string())
    .describe("Specific languages, frameworks, tools, platforms"),
  valuesOrCulture: z
    .array(z.string())
    .describe("Stated values, working style, team norms"),
  notable: z
    .array(z.string())
    .describe("Customers, funding, scale, projects, awards"),
});

export type SubPageExtract = z.infer<typeof subPageExtractSchema>;

export const companyResearchSchema = z.object({
  companyOverview: z.string(),
  techStack: z.array(z.string()),
  culture: z.array(z.string()),
  whyThisRole: z.string(),
  yourEdge: z.array(z.string()),
  gapsToAddress: z.array(z.string()),
  smartQuestions: z.array(z.string()),
  interviewPrep: z.array(z.string()),
  sources: z.array(z.string()),
});

export const HOMEPAGE_EXTRACT_INSTRUCTION =
  "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, customers, scale, mission, recent launches). Then return only internal links useful for researching them as an employer: About, Careers, Team, Engineering, or Blog. Never return Sign in, Register, Shop, Sale, Cart, Checkout, Account, or promotional/storefront links.";

export const SUBPAGE_EXTRACT_INSTRUCTION =
  "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.";

export const RESEARCH_SYNTHESIS_SYSTEM_PROMPT = `You are a sharp career strategist preparing a candidate to apply for a specific role.
You are given (a) research collected from the company's own website, (b) the job posting,
and (c) the candidate's profile. Produce a concise, concrete briefing that gives this
specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent
  funding, customers, headcount, or facts. If research was thin, infer carefully from
  the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this
  company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly
  and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind
  of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON with exactly these keys (no other keys):
{
  "companyOverview": string,
  "techStack": string[],
  "culture": string[],
  "whyThisRole": string,
  "yourEdge": string[],
  "gapsToAddress": string[],
  "smartQuestions": string[],
  "interviewPrep": string[],
  "sources": string[]
}
Do NOT use keys like company, role, candidate, strengths, weaknesses, strategies,
talkingPoints, or questions.`;

const PREFERRED_LINK_KINDS = [
  "about",
  "careers",
  "team",
  "engineering",
  "blog",
] as const;

export function pickSubPageLinks(
  links: HomepageExtract["pageLinks"],
  max = 1,
): HomepageExtract["pageLinks"] {
  const preferred = links.filter((link) =>
    (PREFERRED_LINK_KINDS as readonly string[]).includes(link.kind),
  );
  const rest = links.filter(
    (link) => !(PREFERRED_LINK_KINDS as readonly string[]).includes(link.kind),
  );
  const ordered = [...preferred, ...rest];
  const seen = new Set<string>();
  const picked: HomepageExtract["pageLinks"] = [];
  for (const link of ordered) {
    const url = link.url.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    picked.push({ ...link, url });
    if (picked.length >= max) break;
  }
  return picked;
}

export function isHomepageExtractThin(extract: HomepageExtract): boolean {
  return (
    extract.oneLiner.trim().length === 0 &&
    extract.productSummary.trim().length === 0
  );
}

export function buildResearchSynthesisUserPrompt(input: {
  companyResearch: unknown;
  job: Pick<
    Job,
    | "title"
    | "company"
    | "about_role"
    | "matched_skills"
    | "missing_skills"
    | "responsibilities"
    | "requirements"
  >;
  profile: Pick<
    Profile,
    | "current_title"
    | "years_experience"
    | "experience_level"
    | "skills"
    | "work_experience"
  >;
}): string {
  const descriptionParts = [
    input.job.about_role,
    input.job.responsibilities.length > 0
      ? `Responsibilities: ${input.job.responsibilities.join("; ")}`
      : null,
    input.job.requirements.length > 0
      ? `Requirements: ${input.job.requirements.join("; ")}`
      : null,
  ].filter(Boolean);

  return `COMPANY RESEARCH (from their website):
${JSON.stringify(input.companyResearch)}

JOB POSTING:
Title: ${input.job.title ?? ""}
Company: ${input.job.company ?? ""}
Description: ${descriptionParts.join("\n") || "(none)"}
Matched skills (already computed): ${input.job.matched_skills.join(", ") || "(none)"}
Missing skills (already computed): ${input.job.missing_skills.join(", ") || "(none)"}

CANDIDATE PROFILE:
Current title: ${input.profile.current_title ?? ""}
Experience: ${input.profile.years_experience ?? "?"} years, level ${input.profile.experience_level ?? "?"}
Skills: ${input.profile.skills.join(", ")}
Work history: ${JSON.stringify(input.profile.work_experience)}

Respond with JSON using ONLY the dossier keys listed in the system prompt.`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractJsonCandidates(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const candidates: string[] = [trimmed];

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) candidates.unshift(fence[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return candidates;
}

function tryParseJsonCandidate(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

function extractTechnologiesFromBrowse(companyResearch: unknown): string[] {
  if (!companyResearch || typeof companyResearch !== "object") return [];
  const record = companyResearch as {
    pages?: Array<{ extract?: { technologies?: unknown } }>;
    homepage?: { signals?: unknown };
  };
  const techs: string[] = [];
  for (const page of record.pages ?? []) {
    techs.push(...asStringArray(page.extract?.technologies));
  }
  return [...new Set(techs.map((t) => t.trim()).filter(Boolean))];
}

function extractCultureFromBrowse(companyResearch: unknown): string[] {
  if (!companyResearch || typeof companyResearch !== "object") return [];
  const record = companyResearch as {
    pages?: Array<{ extract?: { valuesOrCulture?: unknown } }>;
  };
  const culture: string[] = [];
  for (const page of record.pages ?? []) {
    culture.push(...asStringArray(page.extract?.valuesOrCulture));
  }
  return [...new Set(culture.map((c) => c.trim()).filter(Boolean))];
}

/**
 * Map alternate free-model shapes (strengths/questions/…) onto the dossier schema.
 */
export function mapAlternateResearchShape(
  value: unknown,
  sourcesFallback: string[],
  context?: {
    companyResearch?: unknown;
    job?: Pick<Job, "title" | "company" | "about_role" | "matched_skills">;
  },
): CompanyResearch | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const strict = companyResearchSchema.safeParse(value);
  if (strict.success) {
    return normalizeCompanyResearch(strict.data, sourcesFallback);
  }

  const company = asTrimmedString(record.company) || context?.job?.company?.trim() || "";
  const role = asTrimmedString(record.role) || context?.job?.title?.trim() || "";

  const yourEdge = [
    ...asStringArray(record.yourEdge),
    ...asStringArray(record.strengths),
  ];
  const gapsToAddress = [
    ...asStringArray(record.gapsToAddress),
    ...asStringArray(record.weaknesses),
    ...asStringArray(record.strategies),
  ];
  const smartQuestions = [
    ...asStringArray(record.smartQuestions),
    ...asStringArray(record.questions),
  ];
  const interviewPrep = [
    ...asStringArray(record.interviewPrep),
    ...asStringArray(record.talkingPoints),
  ];

  let techStack = asStringArray(record.techStack);
  if (techStack.length === 0) {
    techStack = extractTechnologiesFromBrowse(context?.companyResearch);
  }
  if (techStack.length === 0 && context?.job?.matched_skills?.length) {
    techStack = context.job.matched_skills.filter(Boolean);
  }

  let culture = asStringArray(record.culture);
  if (culture.length === 0) {
    culture = extractCultureFromBrowse(context?.companyResearch);
  }

  let companyOverview = asTrimmedString(record.companyOverview);
  if (!companyOverview && company) {
    companyOverview = role
      ? `${company} is hiring for ${role}. Use the job posting and public company pages to verify product focus and team priorities before applying.`
      : `Research notes for ${company}. Verify product focus and culture on the company website before applying.`;
  }

  let whyThisRole = asTrimmedString(record.whyThisRole);
  if (!whyThisRole && role) {
    whyThisRole = context?.job?.about_role?.trim()
      ? `This ${role} role aligns with needs described in the posting; confirm day-to-day priorities with the hiring team.`
      : `The ${role} opening appears tied to product needs in the posting; confirm priorities in the interview.`;
  }

  const sourcesRaw = asStringArray(record.sources);
  const sources = sourcesRaw.length > 0 ? sourcesRaw : sourcesFallback;

  const hasUsefulContent =
    Boolean(companyOverview) ||
    yourEdge.length > 0 ||
    gapsToAddress.length > 0 ||
    smartQuestions.length > 0 ||
    interviewPrep.length > 0 ||
    techStack.length > 0;

  if (!hasUsefulContent) return null;

  return normalizeCompanyResearch(
    {
      companyOverview:
        companyOverview ||
        "Limited structured research was recovered; review the job posting carefully.",
      techStack,
      culture,
      whyThisRole:
        whyThisRole ||
        "Confirm role priorities with the hiring team using the job posting.",
      yourEdge:
        yourEdge.length > 0
          ? yourEdge
          : [
              "Lead with relevant experience from your profile that maps to the posting's requirements.",
            ],
      gapsToAddress:
        gapsToAddress.length > 0
          ? gapsToAddress
          : [
              "Frame any missing skills as adjacent strengths and a short learning plan.",
            ],
      smartQuestions:
        smartQuestions.length > 0
          ? smartQuestions
          : [
              "What would success look like in the first 90 days for this role?",
            ],
      interviewPrep:
        interviewPrep.length > 0
          ? interviewPrep
          : [
              "Re-read the job description and prepare one concrete example for each core requirement.",
            ],
      sources,
    },
    sourcesFallback,
  );
}

/**
 * Recover a dossier from free-model markdown / wrong-key JSON after generateObject fails.
 */
export function healCompanyResearchFromText(
  text: string,
  sourcesFallback: string[],
  context?: {
    companyResearch?: unknown;
    job?: Pick<Job, "title" | "company" | "about_role" | "matched_skills">;
  },
): CompanyResearch | null {
  for (const candidate of extractJsonCandidates(text)) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed == null) continue;
    const healed = mapAlternateResearchShape(
      parsed,
      sourcesFallback,
      context,
    );
    if (healed) return healed;
  }
  return null;
}

/** Heal from AI_NoObjectGeneratedError text or cause.value. */
export function healCompanyResearchFromError(
  error: unknown,
  sourcesFallback: string[],
  context?: {
    companyResearch?: unknown;
    job?: Pick<Job, "title" | "company" | "about_role" | "matched_skills">;
  },
): CompanyResearch | null {
  if (error && typeof error === "object") {
    if (
      "text" in error &&
      typeof (error as { text: unknown }).text === "string"
    ) {
      const text = (error as { text: string }).text.trim();
      if (text) {
        const fromText = healCompanyResearchFromText(
          text,
          sourcesFallback,
          context,
        );
        if (fromText) return fromText;
      }
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === "object" && "value" in cause) {
      const mapped = mapAlternateResearchShape(
        (cause as { value: unknown }).value,
        sourcesFallback,
        context,
      );
      if (mapped) return mapped;
    }
  }
  return null;
}

export function emptyDossierFallback(input: {
  company: string | null;
  sources: string[];
  job?: Pick<
    Job,
    "title" | "company" | "about_role" | "matched_skills" | "missing_skills"
  >;
  profile?: Pick<Profile, "current_title" | "skills">;
}): CompanyResearch {
  const company =
    input.job?.company?.trim() ||
    input.company?.trim() ||
    "this company";
  const title = input.job?.title?.trim() || "this role";
  const matched = (input.job?.matched_skills ?? []).filter(Boolean);
  const missing = (input.job?.missing_skills ?? []).filter(Boolean);
  const profileSkills = (input.profile?.skills ?? []).filter(Boolean);
  const techHints =
    matched.length > 0
      ? matched
      : profileSkills.slice(0, 8);

  const yourEdge =
    matched.length > 0
      ? matched.map(
          (skill) =>
            `Highlight your ${skill} experience as direct overlap with ${title} at ${company}.`,
        )
      : profileSkills.length > 0
        ? [
            `Lead with ${profileSkills.slice(0, 3).join(", ")} from your profile and map them to ${title}.`,
          ]
        : [
            "Lead with relevant experience from your profile that maps to the posting's requirements.",
          ];

  const gapsToAddress =
    missing.length > 0
      ? missing.map(
          (skill) =>
            `Address the ${skill} gap by framing adjacent experience and a short learning plan for ${company}.`,
        )
      : [
          "Frame any missing skills as adjacent strengths and a short learning plan.",
        ];

  return {
    companyOverview: `Limited public research was available for ${company}. Review the ${title} posting carefully and verify claims on the company website before applying.`,
    techStack: techHints,
    culture: [],
    whyThisRole: input.job?.about_role?.trim()
      ? `This ${title} opening at ${company} aligns with needs described in the posting; confirm day-to-day priorities with the hiring team.`
      : `The ${title} role at ${company} appears tied to needs in the job posting; confirm priorities with the hiring team.`,
    yourEdge,
    gapsToAddress,
    smartQuestions: [
      `What would success look like in the first 90 days for the ${title} role at ${company}?`,
    ],
    interviewPrep: [
      `Re-read the ${title} description for ${company} and prepare one concrete example for each core requirement.`,
    ],
    sources: input.sources,
  };
}

export function normalizeCompanyResearch(
  value: z.infer<typeof companyResearchSchema>,
  sourcesFallback: string[],
): CompanyResearch {
  const sources =
    value.sources.filter((s) => s.trim().length > 0).length > 0
      ? value.sources.filter((s) => s.trim().length > 0)
      : sourcesFallback;
  return {
    companyOverview: value.companyOverview.trim(),
    techStack: value.techStack.map((s) => s.trim()).filter(Boolean),
    culture: value.culture.map((s) => s.trim()).filter(Boolean),
    whyThisRole: value.whyThisRole.trim(),
    yourEdge: value.yourEdge.map((s) => s.trim()).filter(Boolean),
    gapsToAddress: value.gapsToAddress.map((s) => s.trim()).filter(Boolean),
    smartQuestions: value.smartQuestions.map((s) => s.trim()).filter(Boolean),
    interviewPrep: value.interviewPrep.map((s) => s.trim()).filter(Boolean),
    sources,
  };
}
