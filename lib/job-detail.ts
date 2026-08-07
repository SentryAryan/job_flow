import type { CompanyResearch, Job, JobSource } from "@/types";

const EM_DASH = "—";

function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const JOB_TYPE_LABELS: Record<string, string> = {
  fulltime: "Full-time",
  full_time: "Full-time",
  "full-time": "Full-time",
  parttime: "Part-time",
  part_time: "Part-time",
  "part-time": "Part-time",
  contract: "Contract",
  permanent: "Permanent",
  temporary: "Temporary",
  internship: "Internship",
};

export type JobDbRow = {
  id: string;
  run_id?: string | null;
  user_id: string;
  source?: string | null;
  source_url?: string | null;
  external_apply_url?: string | null;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  salary?: string | null;
  job_type?: string | null;
  about_role?: string | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  nice_to_have?: string[] | null;
  benefits?: string[] | null;
  about_company?: string | null;
  match_score?: number | null;
  match_reason?: string | null;
  matched_skills?: string[] | null;
  missing_skills?: string[] | null;
  company_research?: unknown;
  researched_at?: string | null;
  found_at: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function clampMatchScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asJobSource(value: unknown): JobSource {
  return value === "url" ? "url" : "search";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseCompanyResearch(value: unknown): CompanyResearch | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    !isNonEmptyString(row.companyOverview) ||
    !isNonEmptyString(row.whyThisRole) ||
    !Array.isArray(row.techStack) ||
    !Array.isArray(row.culture) ||
    !Array.isArray(row.yourEdge) ||
    !Array.isArray(row.gapsToAddress) ||
    !Array.isArray(row.smartQuestions) ||
    !Array.isArray(row.interviewPrep) ||
    !Array.isArray(row.sources)
  ) {
    return null;
  }
  return {
    companyOverview: row.companyOverview.trim(),
    techStack: asStringArray(row.techStack),
    culture: asStringArray(row.culture),
    whyThisRole: row.whyThisRole.trim(),
    yourEdge: asStringArray(row.yourEdge),
    gapsToAddress: asStringArray(row.gapsToAddress),
    smartQuestions: asStringArray(row.smartQuestions),
    interviewPrep: asStringArray(row.interviewPrep),
    sources: asStringArray(row.sources).filter(isSafeHttpUrl),
  };
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Humanize Adzuna contract_type values for display. */
export function formatJobType(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return EM_DASH;
  const key = trimmed.toLowerCase().replace(/\s+/g, "_");
  if (JOB_TYPE_LABELS[key]) return JOB_TYPE_LABELS[key];
  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join("-");
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Strip HTML tags and decode common entities for safe plain-text display. */
export function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const withoutTags = html.replace(/<[^>]*>/g, " ");
  const decoded = withoutTags.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (ENTITY_MAP[lower]) return ENTITY_MAP[lower];
      if (lower.startsWith("#x")) {
        const code = Number.parseInt(lower.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (lower.startsWith("#")) {
        const code = Number.parseInt(lower.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    },
  );
  return decoded.replace(/\s+/g, " ").trim();
}

export function getApplyUrl(job: {
  external_apply_url?: string | null;
  source_url?: string | null;
}): string | null {
  const external = job.external_apply_url?.trim() ?? "";
  if (external && isSafeHttpUrl(external)) return external;
  const source = job.source_url?.trim() ?? "";
  if (source && isSafeHttpUrl(source)) return source;
  return null;
}

/**
 * Match score badge classes for the job header pill.
 * PNG uses light-green success for typical high matches (≥70).
 */
export function getMatchBadgeClass(score: number): string {
  if (score >= 70) {
    return "bg-success-lightest text-success-dark";
  }
  return "bg-surface-muted text-warning";
}

export function mapDbRowToJob(row: JobDbRow): Job {
  return {
    id: row.id,
    run_id: row.run_id ?? null,
    user_id: row.user_id,
    source: asJobSource(row.source),
    source_url: row.source_url ?? null,
    external_apply_url: row.external_apply_url ?? null,
    title: row.title ?? null,
    company: row.company ?? null,
    location: row.location ?? null,
    salary: row.salary ?? null,
    job_type: row.job_type ?? null,
    about_role: row.about_role ?? null,
    responsibilities: asStringArray(row.responsibilities),
    requirements: asStringArray(row.requirements),
    nice_to_have: asStringArray(row.nice_to_have),
    benefits: asStringArray(row.benefits),
    about_company: row.about_company ?? null,
    match_score: clampMatchScore(row.match_score),
    match_reason: row.match_reason ?? null,
    matched_skills: asStringArray(row.matched_skills),
    missing_skills: asStringArray(row.missing_skills),
    company_research: parseCompanyResearch(row.company_research),
    researched_at: row.researched_at ?? null,
    found_at: row.found_at,
  };
}

export function displaySalary(salary: string | null | undefined): string {
  return salary?.trim() || EM_DASH;
}

export function displayLocation(location: string | null | undefined): string {
  return location?.trim() || EM_DASH;
}

export function displayCompany(company: string | null | undefined): string {
  return company?.trim() || "Unknown company";
}

export function displayTitle(title: string | null | undefined): string {
  return title?.trim() || "Untitled role";
}
