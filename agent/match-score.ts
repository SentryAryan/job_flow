import { z } from "zod";

import type { AdzunaJob } from "@/lib/adzuna";
import type { Profile } from "@/types";

export type JobMatchScore = {
  matchScore: number;
  matchReason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

const MAX_SKILLS_PER_LIST = 8;
const MAX_REASON_LENGTH = 280;
const JOB_DESCRIPTION_CHARS = 600;
const PROMPT_SKILLS_CAP = 40;

const scoreRowSchema = z.object({
  index: z.coerce.number().int().min(0),
  matchScore: z.coerce.number().int().min(0).max(100),
  matchReason: z
    .string()
    .max(MAX_REASON_LENGTH)
    .optional()
    .default("Match score estimated from the job snippet."),
  matchedSkills: z
    .array(z.string())
    .max(MAX_SKILLS_PER_LIST)
    .optional()
    .default([]),
  missingSkills: z
    .array(z.string())
    .max(MAX_SKILLS_PER_LIST)
    .optional()
    .default([]),
});

export const jobMatchScoresSchema = z.object({
  scores: z.array(scoreRowSchema),
});

export type JobMatchScoresObject = z.infer<typeof jobMatchScoresSchema>;

export const MATCH_SCORE_SYSTEM_PROMPT = `You score how well job listings match a candidate profile across any industry or sector (tech, healthcare, finance, education, trades, etc.).

Output rules (strict):
- Return ONLY raw JSON. No markdown fences. No commentary.
- Root must be an object: {"scores":[...]} — never a bare array.
- One score object per job, keyed by "index" (0-based).
- matchScore: integer 0-100. Be realistic; do not inflate.
- matchReason: one short sentence (under 200 characters).
- matchedSkills / missingSkills: at most 5 short skill or competency strings each (tools, methods, certifications, soft skills as relevant to the role).
- Use only the provided profile and job snippets.
- Judge fit for the role's domain — do not assume tech/IT.`;

export function buildMatchScoreUserPrompt(
  profile: Profile,
  jobs: readonly AdzunaJob[],
): string {
  const profileBlock = {
    full_name: profile.full_name,
    current_title: profile.current_title,
    experience_level: profile.experience_level,
    years_experience: profile.years_experience,
    skills: profile.skills.slice(0, PROMPT_SKILLS_CAP),
    industries: profile.industries.slice(0, 12),
    job_titles_seeking: profile.job_titles_seeking.slice(0, 8),
    preferred_locations: profile.preferred_locations.slice(0, 8),
    remote_preference: profile.remote_preference,
    salary_expectation: profile.salary_expectation,
    work_experience: profile.work_experience.slice(0, 4).map((role) => ({
      company: role.company,
      title: role.title,
      responsibilities: role.responsibilities.slice(0, 280),
    })),
    education: profile.education,
  };

  const jobsBlock = jobs.map((job, index) => ({
    index,
    title: job.title,
    company: job.company.display_name,
    location: job.location.display_name,
    description: job.description.slice(0, JOB_DESCRIPTION_CHARS),
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    contract_type: job.contract_type ?? null,
  }));

  return [
    "Candidate profile (JSON):",
    JSON.stringify(profileBlock),
    "",
    "Jobs to score (JSON array):",
    JSON.stringify(jobsBlock),
    "",
    `Return {"scores":[...]} with every index 0..${Math.max(0, jobs.length - 1)}.`,
    "Keep each matchReason to one sentence and each skill list to ≤5 items.",
  ].join("\n");
}

function normalizeSkillList(skills: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_SKILLS_PER_LIST) break;
  }
  return out;
}

/** Map model output onto jobs by index; fill gaps with a neutral fallback. */
export function alignMatchScores(
  jobs: readonly AdzunaJob[],
  scored: JobMatchScoresObject,
  profileSkills: readonly string[] = [],
): JobMatchScore[] {
  const byIndex = new Map(
    scored.scores.map((row) => [row.index, row] as const),
  );

  return jobs.map((job, index) => {
    const row = byIndex.get(index);
    if (!row) {
      return fallbackMatchScore(job, profileSkills);
    }

    return {
      matchScore: row.matchScore,
      matchReason:
        row.matchReason.trim().slice(0, MAX_REASON_LENGTH) ||
        "Match score estimated from the job snippet.",
      matchedSkills: normalizeSkillList(row.matchedSkills),
      missingSkills: normalizeSkillList(row.missingSkills),
    };
  });
}

/** Deterministic fallback when AI scoring is unavailable. */
export function fallbackMatchScore(
  job: AdzunaJob,
  profileSkills: readonly string[],
): JobMatchScore {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const matched = profileSkills.filter((skill) =>
    haystack.includes(skill.trim().toLowerCase()),
  );
  const score = Math.min(
    85,
    Math.max(35, 40 + matched.length * 8),
  );

  return {
    matchScore: score,
    matchReason:
      matched.length > 0
        ? `Estimated match from overlapping skills (${matched.slice(0, 5).join(", ")}) in the job title and snippet.`
        : "Estimated match from the job title and description snippet; limited profile overlap found.",
    matchedSkills: matched.slice(0, 12),
    missingSkills: [],
  };
}

export function fallbackMatchScores(
  jobs: readonly AdzunaJob[],
  profile: Profile,
): JobMatchScore[] {
  return jobs.map((job) => fallbackMatchScore(job, profile.skills));
}

function tryParseJsonCandidate(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

/** Pull complete `{...}` elements from a truncated JSON array body. */
function extractCompleteObjectsFromArrayText(text: string): unknown[] {
  const start = text.indexOf("[");
  if (start === -1) return [];

  const objects: unknown[] = [];
  let i = start + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i += 1;
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") break;

    let depth = 0;
    let inString = false;
    let escape = false;
    const objStart = i;
    let closed = false;
    for (; i < text.length; i += 1) {
      const ch = text[i]!;
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const raw = text.slice(objStart, i + 1);
          const parsed = tryParseJsonCandidate(raw);
          if (parsed != null) objects.push(parsed);
          i += 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
  }
  return objects;
}

function extractJsonCandidates(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const candidates: string[] = [trimmed];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) candidates.unshift(fence[1].trim());

  // Unclosed fence (common when finishReason=length mid-fence)
  const openFence = /```(?:json)?\s*([\s\S]*)$/i.exec(trimmed);
  if (openFence?.[1] && !fence) {
    candidates.unshift(openFence[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  for (const start of [firstBrace, firstBracket]) {
    if (start === -1) continue;
    let slice = trimmed.slice(start);
    slice = slice.replace(/,\s*$/, "");
    // Drop trailing incomplete string fragment after last complete value
    slice = slice.replace(/,\s*"[^"]*$/, "");
    slice = slice.replace(/:\s*"[^"]*$/, ': ""');
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

function coerceToScoresObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return { scores: value };
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { scores?: unknown }).scores)
  ) {
    return value;
  }
  return value;
}

function softParseScoresObject(value: unknown): JobMatchScoresObject | null {
  const coerced = coerceToScoresObject(value);
  const parsed = jobMatchScoresSchema.safeParse(coerced);
  if (parsed.success && parsed.data.scores.length > 0) {
    return parsed.data;
  }

  // Keep valid rows even if some entries fail strict schema
  if (
    coerced &&
    typeof coerced === "object" &&
    Array.isArray((coerced as { scores?: unknown }).scores)
  ) {
    const rows: z.infer<typeof scoreRowSchema>[] = [];
    for (const row of (coerced as { scores: unknown[] }).scores) {
      const rowParsed = scoreRowSchema.safeParse(row);
      if (rowParsed.success) rows.push(rowParsed.data);
    }
    if (rows.length > 0) return { scores: rows };
  }

  return null;
}

/**
 * Recover `{ scores }` from free-model markdown / truncated / bare-array JSON.
 */
export function healJobMatchScoresFromText(
  text: string,
): JobMatchScoresObject | null {
  for (const candidate of extractJsonCandidates(text)) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed == null) continue;
    const healed = softParseScoresObject(parsed);
    if (healed) return healed;
  }

  // Truncated mid-object: keep every complete `{...}` score row found in text
  for (const source of [text, ...extractJsonCandidates(text)]) {
    const objects = extractCompleteObjectsFromArrayText(source);
    if (objects.length === 0) continue;
    const healed = softParseScoresObject(objects);
    if (healed) return healed;
  }

  return null;
}

/** Pull recoverable model text from AI SDK / generateObject errors. */
export function extractModelTextFromError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (
    "text" in error &&
    typeof (error as { text: unknown }).text === "string"
  ) {
    const text = (error as { text: string }).text.trim();
    if (text) return text;
  }
  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "text" in cause) {
    const text = (cause as { text: unknown }).text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return null;
}
