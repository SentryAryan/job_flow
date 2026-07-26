import { z } from "zod";

import type { Education, Profile, WorkExperienceRole } from "@/types";

export const MAX_BULLETS_PER_ROLE = 4;
export const MAX_EXPERIENCE_ROLES = 4;
export const MAX_SUMMARY_CHARS = 320;

export const GENERATE_SYSTEM_PROMPT = `You polish a job seeker's profile into concise resume copy for a single-page PDF.

CRITICAL OUTPUT RULES:
- Respond with a single JSON object only. No markdown, no headings, no bullet lists outside JSON, no code fences, no commentary.
- Shape must be exactly:
  {"summary":"string","experience":[{"bullets":["string"]}],"skills_line":"string|null","industries_line":"string|null"}
- experience length must equal the number of work_experience roles in the input, same order.
- Each bullets array: up to ${MAX_BULLETS_PER_ROLE} action-led strings distilled only from that role's responsibilities. Never invent employers, degrees, skills, dates, or metrics.
- summary: 2–3 short sentences under ${MAX_SUMMARY_CHARS} characters.
- skills_line / industries_line: comma-separated from the provided lists only, or null.
- Prefer brevity — the PDF must fit one A4 page.`;

export const resumeGenerateSchema = z.object({
  summary: z.string(),
  experience: z.array(
    z.object({
      bullets: z.array(z.string()),
    }),
  ),
  skills_line: z.string().nullable().optional(),
  industries_line: z.string().nullable().optional(),
});

export type ResumeGenerateAi = z.infer<typeof resumeGenerateSchema>;

export type PolishedExperienceRole = {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  bullets: string[];
};

export type PolishedResumeContent = {
  summary: string;
  experience: PolishedExperienceRole[];
  skills_line: string | null;
  industries_line: string | null;
};

export type ResumePdfLink = { label: string; url: string };

export type ResumePdfEducation = {
  institution: string;
  degreeLine: string;
  locationOrYear: string;
};

export type ResumePdfModel = {
  full_name: string;
  current_title: string | null;
  subtitle: string | null;
  contactParts: string[];
  links: ResumePdfLink[];
  summary: string | null;
  education: ResumePdfEducation | null;
  skills_line: string | null;
  industries_line: string | null;
  experience: PolishedExperienceRole[];
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasEducationContent(education: Partial<Education>): boolean {
  return Boolean(
    trimOrNull(education.institution) ||
      trimOrNull(education.degree) ||
      trimOrNull(education.field_of_study) ||
      trimOrNull(education.graduation_year),
  );
}

export function canGenerateResume(profile: Profile): boolean {
  if (!trimOrNull(profile.full_name)) return false;
  if (profile.skills.length > 0) return true;
  if (profile.work_experience.length > 0) return true;
  if (hasEducationContent(profile.education)) return true;
  return false;
}

function splitResponsibilities(text: string): string[] {
  return text
    .split(/\n|(?<=\.)\s+/)
    .map((part) => part.replace(/^[•\-\*\u2022]\s*/, "").trim())
    .filter((part) => part.length > 0)
    .slice(0, MAX_BULLETS_PER_ROLE);
}

function normalizeBullets(bullets: unknown, fallbackText: string): string[] {
  const fromAi = Array.isArray(bullets)
    ? bullets
        .filter((b): b is string => typeof b === "string")
        .map((b) => b.trim())
        .filter(Boolean)
    : [];

  const source = fromAi.length > 0 ? fromAi : splitResponsibilities(fallbackText);
  return source.slice(0, MAX_BULLETS_PER_ROLE);
}

export function finalizeResumeGenerate(
  raw: unknown,
  profile: Profile,
): PolishedResumeContent {
  const parsed = resumeGenerateSchema.safeParse(raw);
  const data = parsed.success
    ? parsed.data
    : {
        summary: "",
        experience: [],
        skills_line: null,
        industries_line: null,
      };

  const summary =
    trimOrNull(data.summary) ??
    trimOrNull(
      [
        profile.current_title,
        profile.years_experience != null
          ? `${profile.years_experience}+ years experience`
          : null,
        profile.skills.slice(0, 5).join(", ") || null,
      ]
        .filter(Boolean)
        .join(". "),
    ) ??
    "Professional seeking new opportunities.";

  const experience: PolishedExperienceRole[] = profile.work_experience.map(
    (role, index) => {
      const aiEntry = data.experience[index];
      return {
        company: role.company,
        title: role.title,
        start_date: role.start_date,
        end_date: role.end_date,
        is_current: role.is_current,
        bullets: normalizeBullets(aiEntry?.bullets, role.responsibilities),
      };
    },
  );

  const skills_line =
    trimOrNull(data.skills_line ?? null) ??
    (profile.skills.length > 0 ? profile.skills.join(", ") : null);

  const industries_line =
    trimOrNull(data.industries_line ?? null) ??
    (profile.industries.length > 0 ? profile.industries.join(", ") : null);

  return truncateForOnePage({
    summary,
    experience,
    skills_line,
    industries_line,
  });
}

/** Deterministic polish when the model is unavailable or returns unusable text. */
export function polishResumeFromProfile(profile: Profile): PolishedResumeContent {
  return finalizeResumeGenerate({}, profile);
}

function tryParseJsonCandidate(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
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

  if (firstBrace !== -1) {
    let slice = trimmed.slice(firstBrace);
    slice = slice.replace(/,\s*$/, "");
    const opens = (slice.match(/\{/g) ?? []).length;
    const closes = (slice.match(/\}/g) ?? []).length;
    const openArr = (slice.match(/\[/g) ?? []).length;
    const closeArr = (slice.match(/\]/g) ?? []).length;
    slice += "]".repeat(Math.max(0, openArr - closeArr));
    slice += "}".repeat(Math.max(0, opens - closes));
    candidates.push(slice);
  }

  return candidates;
}

function sectionBody(text: string, heading: string): string | null {
  const pattern = new RegExp(
    `(?:\\*\\*|#{1,3}\\s*)${heading}\\*?\\*?\\s*\\n+([\\s\\S]*?)(?=\\n\\s*(?:\\*\\*|#{1,3}\\s*)(?:Summary|Experience|Skills|Industries)\\b|$)`,
    "i",
  );
  const match = pattern.exec(text);
  return match?.[1]?.trim() ?? null;
}

function parseBulletLines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s+/, "").trim())
    .filter((line) => line.length > 0 && !/^\*\*/.test(line))
    .slice(0, MAX_BULLETS_PER_ROLE);
}

function normalizeCompanyKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Recover structured generate payload from free-model markdown prose
 * (e.g. **Summary** / **Experience** / **Skills** instead of JSON).
 */
export function parseMarkdownGenerateText(
  text: string,
  profile: Profile,
): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const looksLikeMarkdown =
    /\*\*Summary\*\*/i.test(trimmed) ||
    /^#{1,3}\s*Summary\b/im.test(trimmed) ||
    /\*\*Experience\*\*/i.test(trimmed);
  if (!looksLikeMarkdown) return null;

  const summary = sectionBody(trimmed, "Summary");
  const skillsBody = sectionBody(trimmed, "Skills");
  const industriesBody = sectionBody(trimmed, "Industries");
  const experienceBody = sectionBody(trimmed, "Experience");

  const experienceEntries: { bullets: string[] }[] = profile.work_experience.map(
    () => ({ bullets: [] as string[] }),
  );

  if (experienceBody) {
    const roleBlocks = experienceBody.split(/(?=^\*\*[^*].+\*\*)/m).filter(Boolean);
    let unmatched = [...profile.work_experience.keys()];

    for (const block of roleBlocks) {
      const header = /^\*\*(.+?)\*\*/.exec(block.trim());
      if (!header?.[1]) continue;
      const headerText = header[1];
      const bullets = parseBulletLines(block.replace(/^\*\*.+?\*\*[^\n]*\n?/, ""));

      let roleIndex = unmatched.find(
        (index) =>
          normalizeCompanyKey(headerText).includes(
            normalizeCompanyKey(profile.work_experience[index]!.company),
          ) ||
          normalizeCompanyKey(headerText).includes(
            normalizeCompanyKey(profile.work_experience[index]!.title),
          ),
      );

      if (roleIndex == null && unmatched.length > 0) {
        roleIndex = unmatched[0];
      }
      if (roleIndex == null) continue;

      experienceEntries[roleIndex] = { bullets };
      unmatched = unmatched.filter((index) => index !== roleIndex);
    }
  }

  if (!summary && experienceEntries.every((e) => e.bullets.length === 0)) {
    return null;
  }

  return {
    summary: summary ?? "",
    experience: experienceEntries,
    skills_line: skillsBody
      ? skillsBody.replace(/\s+/g, " ").replace(/\.$/, "").trim()
      : null,
    industries_line: industriesBody
      ? industriesBody.replace(/\s+/g, " ").replace(/\.$/, "").trim()
      : null,
  };
}

/** Parse model text (JSON or markdown) into polished resume content. */
export function parseGenerateFromModelText(
  text: string,
  profile: Profile,
): PolishedResumeContent | null {
  for (const candidate of extractJsonCandidates(text)) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed != null) {
      return finalizeResumeGenerate(parsed, profile);
    }
  }

  const fromMarkdown = parseMarkdownGenerateText(text, profile);
  if (fromMarkdown) {
    return finalizeResumeGenerate(fromMarkdown, profile);
  }

  return null;
}

type GenerateErrorLike = {
  text?: unknown;
  cause?: { value?: unknown };
};

/** Heal NoObjectGeneratedError / JSON parse failures into usable polish. */
export function healGenerateFromError(
  error: unknown,
  profile: Profile,
): PolishedResumeContent | null {
  const record =
    error && typeof error === "object" ? (error as GenerateErrorLike) : null;

  const text = typeof record?.text === "string" ? record.text : "";
  if (text) {
    const fromText = parseGenerateFromModelText(text, profile);
    if (fromText) return fromText;
  }

  if (record?.cause?.value != null) {
    return finalizeResumeGenerate(record.cause.value, profile);
  }

  return null;
}

export function truncateForOnePage(
  content: PolishedResumeContent,
): PolishedResumeContent {
  const summary =
    content.summary.length > MAX_SUMMARY_CHARS
      ? `${content.summary.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…`
      : content.summary;

  return {
    summary,
    experience: content.experience.slice(0, MAX_EXPERIENCE_ROLES).map((role) => ({
      ...role,
      bullets: role.bullets.slice(0, MAX_BULLETS_PER_ROLE),
    })),
    skills_line: content.skills_line,
    industries_line: content.industries_line,
  };
}

function formatEducation(education: Partial<Education>): ResumePdfEducation | null {
  if (!hasEducationContent(education)) return null;

  const degreeParts = [
    trimOrNull(education.degree),
    trimOrNull(education.field_of_study),
  ].filter(Boolean);

  return {
    institution: trimOrNull(education.institution) ?? "",
    degreeLine: degreeParts.join(" in ") || degreeParts.join(" "),
    locationOrYear: trimOrNull(education.graduation_year) ?? "",
  };
}

function buildSubtitle(profile: Profile): string | null {
  const parts: string[] = [];
  if (trimOrNull(profile.experience_level)) {
    parts.push(profile.experience_level!);
  }
  if (profile.years_experience != null && profile.years_experience > 0) {
    parts.push(`${profile.years_experience} years experience`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildResumePdfModel(
  profile: Profile,
  polished: PolishedResumeContent,
): ResumePdfModel {
  const contactParts = [
    trimOrNull(profile.location),
    trimOrNull(profile.phone),
    trimOrNull(profile.email),
  ].filter((part): part is string => Boolean(part));

  const links: ResumePdfLink[] = [];
  const portfolio = trimOrNull(profile.portfolio_url);
  const linkedin = trimOrNull(profile.linkedin_url);
  if (portfolio) links.push({ label: "Portfolio", url: portfolio });
  if (linkedin) links.push({ label: "LinkedIn", url: linkedin });

  return {
    full_name: trimOrNull(profile.full_name) ?? "Resume",
    current_title: trimOrNull(profile.current_title),
    subtitle: buildSubtitle(profile),
    contactParts,
    links,
    summary: trimOrNull(polished.summary),
    education: formatEducation(profile.education),
    skills_line: polished.skills_line,
    industries_line: polished.industries_line,
    experience: polished.experience,
  };
}

export function buildGenerateUserPrompt(profile: Profile): string {
  const roles = profile.work_experience.map((role: WorkExperienceRole) => ({
    company: role.company,
    title: role.title,
    start_date: role.start_date,
    end_date: role.end_date,
    is_current: role.is_current,
    responsibilities: role.responsibilities,
  }));

  return `Return JSON only for this profile (experience[].bullets length must match work_experience order):

${JSON.stringify(
  {
    full_name: profile.full_name,
    current_title: profile.current_title,
    experience_level: profile.experience_level,
    years_experience: profile.years_experience,
    skills: profile.skills,
    industries: profile.industries,
    education: profile.education,
    work_experience: roles,
  },
  null,
  2,
)}`;
}
