import { z } from "zod";

import type { Profile, WorkExperienceRole } from "@/types";

export const EMPTY_RESUME_TEXT_ERROR =
  "Could not extract text from this PDF. Please try a different file.";

export const MIN_RESUME_TEXT_LENGTH = 50;

const EXPERIENCE_LEVELS = ["junior", "mid", "senior", "lead"] as const;
const REMOTE_PREFS = ["any", "remote", "hybrid", "onsite"] as const;
const WORK_AUTHS = [
  "citizen",
  "permanent_resident",
  "visa_required",
] as const;

const MONTH_NAME_TO_NUM: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

/** Exact values for the profile Education "Highest Degree" select. */
export const HIGHEST_DEGREE_OPTIONS = [
  "High School",
  "Associate",
  "Bachelor",
  "Master",
  "PhD",
  "Bootcamp",
  "Other",
] as const;

export type HighestDegree = (typeof HIGHEST_DEGREE_OPTIONS)[number];

export const EXTRACT_SYSTEM_PROMPT = `You are a resume parsing engine for a job-search product.
Return ONE JSON object only (no markdown, no commentary) with these exact snake_case keys:
full_name, phone, location, current_title, experience_level, years_experience,
skills, industries, work_experience, education, job_titles_seeking,
remote_preference, preferred_locations, salary_expectation, linkedin_url,
portfolio_url, work_authorization.

Field rules:
- full_name: person's name. Never use key "name". Never include email.
- phone, location, current_title: strings or null
- experience_level: junior | mid | senior | lead | null (infer from years/title if clear)
- years_experience: integer or null (infer from work history when possible)
- skills: string array of technologies/tools (max 50)
- industries: string array (max 50)
- work_experience: max 3 roles, most recent first. Each role MUST include:
  - company (string)
  - title (string)
  - start_date as "YYYY-MM" (e.g. "2022-01"). Never "Jan 2022" or "2022".
  - end_date as "YYYY-MM" or null when current
  - is_current (boolean)
  - responsibilities as ONE string (join bullets with newlines). Never an array.
- education object:
  - degree: MUST be exactly one of: High School | Associate | Bachelor | Master | PhD | Bootcamp | Other
    Map resume wording: B.Tech/B.E./B.S./Bachelor's → Bachelor; M.Tech/M.S./MBA/Master's → Master;
    Ph.D/Doctorate → PhD; AA/AS → Associate; High School/HSC/12th → High School; coding bootcamp → Bootcamp.
    Never leave degree null/empty when the resume states a degree. Put the major in field_of_study, not degree.
  - field_of_study (e.g. "Computer Science") — ALWAYS separate from degree when the resume mentions a major/field
  - institution
  - graduation_year as "YYYY"
- job_titles_seeking: plausible target titles from current title/skills
- remote_preference: any | remote | hybrid | onsite | null
- preferred_locations: cities/regions from resume, or []
- salary_expectation: smart market estimate from years_experience + skills + location currency.
  Examples: India → "₹12-18 LPA"; US → "$120,000 - $150,000"; EU → "€70,000 - €90,000".
  Infer even when salary is not written on the resume.
- linkedin_url: full https LinkedIn profile URL when present — including when the resume only shows
  hyperlinked text like "LinkedIn" (see EXTRACTED_HYPERLINKS / markdown links in the resume text).
- portfolio_url: GitHub, personal site, or portfolio https URL when present — including hyperlinked
  labels like "GitHub", "Portfolio", "Portfolio Website", "Website" (prefer GitHub if both exist).
- work_authorization: citizen | permanent_resident | visa_required | null

Completeness: prefer filling every key. Use null for unknown scalars, [] for unknown arrays, {} for empty education.
Never invent employers or degrees that are not supported by the resume. Salary may be inferred.
Always read EXTRACTED_HYPERLINKS and markdown [label](url) entries for social/portfolio URLs.`;

function asNullableString(value: unknown, max = 500): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,|;/\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.slice(0, maxLen))
      .slice(0, maxItems);
  }
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" ? [name] : [];
      }
      return [];
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, maxLen))
    .slice(0, maxItems);
}

function asEnumOrNull<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return (allowed as readonly string[]).includes(normalized)
    ? (normalized as T[number])
    : null;
}

function asYears(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(80, Math.round(value)));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(80, parsed));
    }
  }
  return null;
}

function asHttpUrl(value: unknown): string | null {
  const raw = asNullableString(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Coerce model dates into UI format YYYY-MM (month padded). */
export function normalizeDateToYearMonth(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && value >= 1970 && value <= 2100) {
    return `${Math.round(value)}-01`;
  }
  if (typeof value !== "string") return "";

  const raw = value.trim();
  if (!raw) return "";
  if (/^(present|current|now|ongoing)$/i.test(raw)) return "";

  // YYYY-MM or YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(raw);
  if (iso) {
    return `${iso[1]}-${iso[2]!.padStart(2, "0")}`;
  }

  // YYYY/MM or MM/YYYY
  const slashYFirst = /^(\d{4})[/.](\d{1,2})$/.exec(raw);
  if (slashYFirst) {
    return `${slashYFirst[1]}-${slashYFirst[2]!.padStart(2, "0")}`;
  }
  const slashMFirst = /^(\d{1,2})[/.](\d{4})$/.exec(raw);
  if (slashMFirst) {
    return `${slashMFirst[2]}-${slashMFirst[1]!.padStart(2, "0")}`;
  }

  // Mon YYYY / Month YYYY
  const named = /^([A-Za-z]+)\.?\s+(\d{4})$/.exec(raw);
  if (named) {
    const month = MONTH_NAME_TO_NUM[named[1]!.toLowerCase()];
    if (month) return `${named[2]}-${month}`;
  }

  // YYYY only
  const yearOnly = /^(\d{4})$/.exec(raw);
  if (yearOnly) return `${yearOnly[1]}-01`;

  return "";
}

/** Join bullet arrays into a single textarea string. */
export function asResponsibilities(value: unknown): string {
  if (typeof value === "string") return value.trim().slice(0, 5000);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text.trim() : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .slice(0, 5000);
  }
  return "";
}

/** Map resume degree wording onto the Education select options. */
export function normalizeHighestDegree(value: unknown): HighestDegree | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const exact = HIGHEST_DEGREE_OPTIONS.find(
    (option) => option.toLowerCase() === raw.toLowerCase(),
  );
  if (exact) return exact;

  const compact = raw.toLowerCase().replace(/[.\s'_-]+/g, "");

  if (
    /^(highschool|secondary|hsc|ssc|ged|12th|xii|intermediate)$/.test(compact) ||
    /\b(high\s*school|secondary\s*school)\b/i.test(raw)
  ) {
    return "High School";
  }
  if (
    /^(associate|associates|aa|as|aas)$/.test(compact) ||
    /\bassociate\b/i.test(raw)
  ) {
    return "Associate";
  }
  if (
    /^(phd|ph\.?d|doctorate|doctoral|dphil)$/.test(compact) ||
    /\b(ph\.?\s*d|doctorate)\b/i.test(raw)
  ) {
    return "PhD";
  }
  if (
    /^(mba|mtech|me|ms|msc|mca|meng|masters?)$/.test(compact) ||
    /\b(m\.?\s*tech|m\.?\s*s\.?|m\.?\s*eng|master'?s?|mba|post\s*grad)\b/i.test(
      raw,
    )
  ) {
    return "Master";
  }
  if (
    /^(btech|be|bs|bsc|ba|bca|beng|bachelors?)$/.test(compact) ||
    /\b(b\.?\s*tech|b\.?\s*e\.?|b\.?\s*s\.?|b\.?\s*eng|bachelor'?s?)\b/i.test(
      raw,
    )
  ) {
    return "Bachelor";
  }
  if (/bootcamp|coding\s*boot/i.test(raw)) {
    return "Bootcamp";
  }

  return "Other";
}

function splitDegreeAndField(
  degree: string | undefined,
  field: string | undefined,
): { degree?: HighestDegree; field_of_study?: string } {
  if (field?.trim()) {
    return {
      degree: normalizeHighestDegree(degree) ?? undefined,
      field_of_study: field.trim(),
    };
  }
  if (!degree?.trim()) return {};

  const inOf = /^(.+?)\s+(?:in|of)\s+(.+)$/i.exec(degree.trim());
  if (inOf) {
    return {
      degree: normalizeHighestDegree(inOf[1]) ?? undefined,
      field_of_study: inOf[2]!.trim(),
    };
  }

  const prefixed =
    /^(B\.?\s?Tech|B\.?\s?E\.?|M\.?\s?Tech|B\.?\s?S\.?|M\.?\s?S\.?|MBA|Bachelors?|Masters?|Ph\.?D\.?)[\s.,:-]+(.+)$/i.exec(
      degree.trim(),
    );
  if (prefixed) {
    return {
      degree: normalizeHighestDegree(prefixed[1]) ?? undefined,
      field_of_study: prefixed[2]!.trim(),
    };
  }

  return { degree: normalizeHighestDegree(degree) };
}

export type ResumeHyperlink = { text: string; url: string };

/** Collect hyperlinks from resume text (markdown, appendix, bare URLs). */
export function collectResumeHyperlinks(resumeText: string): ResumeHyperlink[] {
  const out: ResumeHyperlink[] = [];
  const seen = new Set<string>();

  const push = (text: string, url: string) => {
    const cleaned = url.trim().replace(/[.,;)\]]+$/, "");
    if (!/^https?:\/\//i.test(cleaned)) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: text.trim(), url: cleaned });
  };

  for (const match of resumeText.matchAll(
    /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi,
  )) {
    push(match[1] ?? "", match[2] ?? "");
  }

  for (const match of resumeText.matchAll(
    /^\s*-\s*(.+?):\s*(https?:\/\/\S+)/gim,
  )) {
    push(match[1] ?? "", match[2] ?? "");
  }

  for (const match of resumeText.matchAll(/https?:\/\/[^\s)\]>"']+/gi)) {
    push("", match[0] ?? "");
  }

  return out;
}

/**
 * Choose LinkedIn + portfolio/GitHub URLs from labeled hyperlinks and bare URLs.
 * Handles resumes where only the anchor text ("LinkedIn", "GitHub") is visible.
 */
export function pickSocialProfileUrls(
  resumeText: string,
  extraLinks: ResumeHyperlink[] = [],
): { linkedin_url: string | null; portfolio_url: string | null } {
  const links = [...extraLinks, ...collectResumeHyperlinks(resumeText)];

  const linkedin =
    links.find(
      (link) =>
        /linkedin\.com\/in\//i.test(link.url) ||
        (/linkedin/i.test(link.text) && /linkedin\.com/i.test(link.url)),
    )?.url ??
    links.find((link) => /linkedin\.com/i.test(link.url))?.url ??
    null;

  const github =
    links.find(
      (link) =>
        /github\.com\/[A-Za-z0-9_-]+/i.test(link.url) &&
        !/github\.com\/(features|topics|marketplace|about)/i.test(link.url),
    )?.url ?? null;

  const portfolioLabeled =
    links.find((link) =>
      /portfolio|website|personal\s*site|my\s*site|behance|dribbble|vercel\.app|netlify/i.test(
        link.text,
      ),
    )?.url ?? null;

  const otherSite =
    links.find((link) => {
      if (/linkedin\.com|mailto:/i.test(link.url)) return false;
      if (github && link.url === github) return false;
      try {
        const host = new URL(link.url).hostname.toLowerCase();
        return Boolean(host) && !host.includes("linkedin.com");
      } catch {
        return false;
      }
    })?.url ?? null;

  const portfolio_url = github ?? portfolioLabeled ?? otherSite ?? null;

  return {
    linkedin_url: linkedin ? asHttpUrl(linkedin) : null,
    portfolio_url: portfolio_url ? asHttpUrl(portfolio_url) : null,
  };
}

function asWorkExperience(value: unknown): WorkExperienceRole[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const company = asNullableString(row.company, 200) ?? "";
      const title = asNullableString(row.title ?? row.role, 200) ?? "";
      if (!company && !title) return null;

      const isCurrent = Boolean(
        row.is_current ??
          row.isCurrent ??
          /present|current|now/i.test(String(row.end_date ?? row.endDate ?? "")),
      );
      const startDate = normalizeDateToYearMonth(
        row.start_date ?? row.startDate ?? row.from,
      );
      const endDateRaw = row.end_date ?? row.endDate ?? row.to;
      const endDate = isCurrent
        ? null
        : normalizeDateToYearMonth(endDateRaw) || null;

      return {
        company,
        title,
        start_date: startDate,
        end_date: endDate,
        is_current: isCurrent,
        responsibilities: asResponsibilities(
          row.responsibilities ??
            row.responsibility ??
            row.bullets ??
            row.highlights ??
            row.description ??
            row.summary,
        ),
      };
    })
    .filter((role): role is NonNullable<typeof role> => role !== null);
}

function asEducation(value: unknown): ProfileExtract["education"] {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const split = splitDegreeAndField(
    asNullableString(row.degree, 100) ?? undefined,
    asNullableString(
      row.field_of_study ?? row.fieldOfStudy ?? row.field ?? row.major,
      200,
    ) ?? undefined,
  );
  return {
    degree: split.degree,
    field_of_study: split.field_of_study,
    institution:
      asNullableString(row.institution ?? row.school ?? row.university, 200) ??
      undefined,
    graduation_year:
      asNullableString(
        row.graduation_year ?? row.graduationYear ?? row.year,
        10,
      )?.replace(/\D/g, "").slice(0, 4) || undefined,
  };
}

/**
 * Map free-model / partial JSON into a valid ProfileExtract.
 * Accepts aliases like `name` → `full_name` and fills missing arrays/nulls.
 */
export function normalizeRawExtract(raw: unknown): ProfileExtract {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    full_name: asNullableString(
      row.full_name ?? row.fullName ?? row.name,
      200,
    ),
    phone: asNullableString(row.phone ?? row.phone_number ?? row.mobile, 50),
    location: asNullableString(row.location ?? row.city ?? row.address, 200),
    current_title: asNullableString(
      row.current_title ?? row.currentTitle ?? row.title ?? row.headline,
      200,
    ),
    experience_level: asEnumOrNull(
      row.experience_level ?? row.experienceLevel ?? row.level,
      EXPERIENCE_LEVELS,
    ),
    years_experience: asYears(
      row.years_experience ?? row.yearsExperience ?? row.experience_years,
    ),
    skills: asStringArray(row.skills ?? row.skill_list, 50, 100),
    industries: asStringArray(row.industries ?? row.industry, 50, 100),
    work_experience: asWorkExperience(
      row.work_experience ?? row.workExperience ?? row.experience ?? row.jobs,
    ),
    education: asEducation(row.education),
    job_titles_seeking: asStringArray(
      row.job_titles_seeking ?? row.jobTitlesSeeking ?? row.target_titles,
      20,
      200,
    ),
    remote_preference: asEnumOrNull(
      row.remote_preference ?? row.remotePreference ?? row.remote,
      REMOTE_PREFS,
    ),
    preferred_locations: asStringArray(
      row.preferred_locations ?? row.preferredLocations,
      20,
      200,
    ),
    salary_expectation: asNullableString(
      row.salary_expectation ?? row.salaryExpectation ?? row.salary,
      100,
    ),
    linkedin_url: asHttpUrl(
      row.linkedin_url ?? row.linkedinUrl ?? row.linkedin,
    ),
    portfolio_url: asHttpUrl(
      row.portfolio_url ?? row.portfolioUrl ?? row.portfolio ?? row.website ?? row.github,
    ),
    work_authorization: asEnumOrNull(
      row.work_authorization ?? row.workAuthorization,
      WORK_AUTHS,
    ),
  };
}

function findDateRangeNear(text: string): {
  start_date: string;
  end_date: string | null;
  is_current: boolean;
} | null {
  const range =
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}[/.]\d{4}|\d{4}-\d{1,2}|\d{4})\s*[-–—to]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}[/.]\d{4}|\d{4}-\d{1,2}|\d{4}|Present|Current|Now)/i.exec(
      text,
    );
  if (!range) return null;
  const isCurrent = /present|current|now/i.test(range[2]!);
  return {
    start_date: normalizeDateToYearMonth(range[1]),
    end_date: isCurrent ? null : normalizeDateToYearMonth(range[2]),
    is_current: isCurrent,
  };
}

function enrichRoleFromResumeText(
  role: WorkExperienceRole,
  resumeText: string,
): WorkExperienceRole {
  const company = role.company.trim();
  if (!company) return role;

  const idx = resumeText.toLowerCase().indexOf(company.toLowerCase());
  if (idx === -1) return role;

  const window = resumeText.slice(Math.max(0, idx - 80), idx + 900);
  let next = { ...role };

  if (!next.start_date) {
    const dates = findDateRangeNear(window);
    if (dates?.start_date) {
      next = {
        ...next,
        start_date: dates.start_date,
        end_date: dates.is_current ? null : dates.end_date ?? next.end_date,
        is_current: dates.is_current || next.is_current,
      };
    }
  }

  if (!next.responsibilities.trim()) {
    const bullets = window.match(/(?:^|\n)\s*[•\-–*—]\s*(.+)/g);
    if (bullets && bullets.length > 0) {
      next = {
        ...next,
        responsibilities: bullets
          .map((line) => line.replace(/^\s*[•\-–*—]\s*/, "").trim())
          .filter(Boolean)
          .slice(0, 8)
          .join("\n")
          .slice(0, 5000),
      };
    }
  }

  return next;
}

function extractEducationFallback(
  resumeText: string,
): ProfileExtract["education"] {
  const eduBlock =
    /education([\s\S]{0,800}?)(?:experience|skills|projects|work|$)/i.exec(
      resumeText,
    )?.[1] ?? resumeText.slice(0, 1200);

  const line =
    /((?:B\.?\s?Tech|B\.?\s?E\.?|M\.?\s?Tech|B\.?\s?S\.?|M\.?\s?S\.?|MBA|Bachelor(?:'s)?|Master(?:'s)?|Ph\.?D\.?)[^\n]{0,120})/i.exec(
      eduBlock,
    )?.[1];

  if (!line) return {};

  const split = splitDegreeAndField(line.trim(), undefined);
  const institution =
    /(?:[-–,|@]|at)\s*([A-Z][A-Za-z0-9&.\s]{2,80})/.exec(line)?.[1]?.trim() ||
    undefined;
  const year = /\b(19|20)\d{2}\b/.exec(line)?.[0];

  return {
    degree: split.degree,
    field_of_study: split.field_of_study,
    institution,
    graduation_year: year,
  };
}

function extractSkillsFallback(resumeText: string): string[] {
  const block =
    /skills[:\s]*([\s\S]{0,500}?)(?:\n\s*\n|experience|education|projects|$)/i.exec(
      resumeText,
    )?.[1];
  if (!block) return [];
  return asStringArray(block.replace(/\n/g, ", "), 50, 100);
}

function inferExperienceLevel(
  years: number | null,
  title: string | null,
): ProfileExtract["experience_level"] {
  const t = (title ?? "").toLowerCase();
  if (/lead|principal|staff|architect|manager/.test(t)) return "lead";
  if (/senior|sr\./.test(t)) return "senior";
  if (/junior|intern|graduate|associate/.test(t)) return "junior";
  if (years == null) return null;
  if (years <= 2) return "junior";
  if (years <= 5) return "mid";
  if (years <= 10) return "senior";
  return "lead";
}

function marketRegion(extracted: ProfileExtract): "IN" | "US" | "EU" | "OTHER" {
  const blob = `${extracted.phone ?? ""} ${extracted.location ?? ""} ${extracted.preferred_locations.join(" ")}`.toLowerCase();
  if (/\+91|india|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|chennai|noida|gurgaon|gurugram/.test(blob)) {
    return "IN";
  }
  if (/\+1|united states|usa|u\.s\.|san francisco|new york|seattle|austin|remote us/.test(blob)) {
    return "US";
  }
  if (/\+44|\+49|\+33|united kingdom|germany|france|netherlands|berlin|london|amsterdam|eu\b/.test(blob)) {
    return "EU";
  }
  return "OTHER";
}

/** Infer salary from level, years, and tech stack when the model omits it. */
export function inferSalaryExpectation(
  extracted: ProfileExtract,
): string | null {
  if (extracted.salary_expectation?.trim()) {
    return extracted.salary_expectation.trim();
  }

  const hasSignal =
    extracted.years_experience != null ||
    extracted.experience_level != null ||
    Boolean(extracted.current_title?.trim()) ||
    extracted.skills.length > 0 ||
    Boolean(extracted.location?.trim()) ||
    Boolean(extracted.phone?.trim()) ||
    extracted.work_experience.length > 0;

  // Do not invent a salary when the resume/extract has no career signal.
  if (!hasSignal) return null;

  const years = extracted.years_experience;
  const level =
    extracted.experience_level ??
    inferExperienceLevel(years, extracted.current_title);
  const skills = extracted.skills.map((s) => s.toLowerCase());
  const premiumStack = skills.some((s) =>
    /react|typescript|next\.?js|node|aws|kubernetes|golang|rust|python|java/.test(
      s,
    ),
  );
  const region = marketRegion(extracted);

  const band = (() => {
    switch (level) {
      case "junior":
        return { IN: "₹4-8 LPA", US: "$70,000 - $95,000", EU: "€40,000 - €55,000", OTHER: "$40,000 - $60,000" };
      case "mid":
        return { IN: "₹10-18 LPA", US: "$100,000 - $140,000", EU: "€55,000 - €80,000", OTHER: "$60,000 - $90,000" };
      case "senior":
        return { IN: "₹20-35 LPA", US: "$140,000 - $190,000", EU: "€80,000 - €110,000", OTHER: "$90,000 - $130,000" };
      case "lead":
        return { IN: "₹35-55 LPA", US: "$180,000 - $240,000", EU: "€110,000 - €150,000", OTHER: "$120,000 - $180,000" };
      default:
        if (years != null && years <= 2) {
          return { IN: "₹4-8 LPA", US: "$70,000 - $95,000", EU: "€40,000 - €55,000", OTHER: "$40,000 - $60,000" };
        }
        if (years != null && years <= 5) {
          return { IN: "₹10-18 LPA", US: "$100,000 - $140,000", EU: "€55,000 - €80,000", OTHER: "$60,000 - $90,000" };
        }
        return { IN: "₹15-28 LPA", US: "$120,000 - $160,000", EU: "€70,000 - €100,000", OTHER: "$70,000 - $110,000" };
    }
  })();

  let value = band[region];
  if (premiumStack && region === "IN" && level === "mid") {
    value = "₹12-20 LPA";
  }
  if (premiumStack && region === "IN" && level === "senior") {
    value = "₹22-40 LPA";
  }
  return value;
}

/**
 * Fill gaps with resume-text heuristics and derived fields (salary, level, titles).
 */
export function applyResumeFallbacks(
  extracted: ProfileExtract,
  resumeText: string,
): ProfileExtract {
  const phoneMatch =
    resumeText.match(
      /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}[\s-]?\d{0,5}/,
    )?.[0] ?? null;

  const educationFallback = extractEducationFallback(resumeText);
  const skillsFallback = extractSkillsFallback(resumeText);
  const social = pickSocialProfileUrls(resumeText);

  let work_experience = extracted.work_experience.map((role) =>
    enrichRoleFromResumeText(role, resumeText),
  );

  // If model returned no roles, leave empty — do not invent employers.
  work_experience = work_experience.map((role) => ({
    ...role,
    start_date: role.start_date || normalizeDateToYearMonth(role.start_date),
    responsibilities: role.responsibilities.trim(),
  }));

  const education = {
    degree:
      normalizeHighestDegree(extracted.education.degree) ||
      educationFallback.degree,
    field_of_study:
      extracted.education.field_of_study || educationFallback.field_of_study,
    institution:
      extracted.education.institution || educationFallback.institution,
    graduation_year:
      extracted.education.graduation_year || educationFallback.graduation_year,
  };

  const skills =
    extracted.skills.length > 0 ? extracted.skills : skillsFallback;

  const years_experience = extracted.years_experience;
  const experience_level =
    extracted.experience_level ??
    inferExperienceLevel(years_experience, extracted.current_title);

  const job_titles_seeking =
    extracted.job_titles_seeking.length > 0
      ? extracted.job_titles_seeking
      : extracted.current_title
        ? [extracted.current_title]
        : [];

  const next: ProfileExtract = {
    ...extracted,
    phone: extracted.phone || asNullableString(phoneMatch, 50),
    linkedin_url: extracted.linkedin_url || social.linkedin_url,
    portfolio_url: extracted.portfolio_url || social.portfolio_url,
    skills,
    work_experience,
    education,
    experience_level,
    years_experience,
    job_titles_seeking,
    salary_expectation: null,
  };

  return {
    ...next,
    salary_expectation: inferSalaryExpectation(next),
  };
}

/** Normalize model output then apply resume fallbacks / inferred salary. */
export function finalizeExtract(
  raw: unknown,
  resumeText: string,
): ProfileExtract {
  return applyResumeFallbacks(normalizeRawExtract(raw), resumeText);
}

/** Try to parse model text (possibly truncated) into a ProfileExtract. */
export function parseExtractFromModelText(
  text: string,
  resumeText = "",
): ProfileExtract | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates: string[] = [trimmed];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) candidates.unshift(fence[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      return resumeText
        ? finalizeExtract(parsed, resumeText)
        : normalizeRawExtract(parsed);
    } catch {
      // try next
    }
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
    try {
      const parsed: unknown = JSON.parse(slice);
      return resumeText
        ? finalizeExtract(parsed, resumeText)
        : normalizeRawExtract(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

const optionalHttpUrl = z
  .string()
  .max(500)
  .nullable()
  .refine(
    (value) => {
      if (value == null || value.trim() === "") return true;
      try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a valid http(s) URL" },
  );

const workExperienceRoleSchema = z.object({
  company: z.string().max(200).describe("Employer name"),
  title: z.string().max(200).describe("Job title"),
  start_date: z
    .string()
    .max(20)
    .describe('Start date as YYYY-MM, e.g. "2022-01"'),
  end_date: z
    .string()
    .max(20)
    .nullable()
    .describe('End date as YYYY-MM, or null if current'),
  is_current: z.boolean().describe("True if this is the current role"),
  responsibilities: z
    .string()
    .max(5000)
    .describe("Key responsibilities as one string; join bullets with newlines"),
});

const educationSchema = z.object({
  degree: z
    .string()
    .max(100)
    .optional()
    .describe(
      'Highest degree: exactly one of High School | Associate | Bachelor | Master | PhD | Bootcamp | Other',
    ),
  field_of_study: z
    .string()
    .max(200)
    .optional()
    .describe('Major/field only, e.g. "Computer Science"'),
  institution: z.string().max(200).optional(),
  graduation_year: z.string().max(10).optional().describe('Year as "YYYY"'),
});

export const profileExtractSchema = z.object({
  full_name: z.string().max(200).nullable().optional().default(null),
  phone: z.string().max(50).nullable().optional().default(null),
  location: z.string().max(200).nullable().optional().default(null),
  current_title: z.string().max(200).nullable().optional().default(null),
  experience_level: z
    .enum(["junior", "mid", "senior", "lead"])
    .nullable()
    .optional()
    .default(null),
  years_experience: z
    .number()
    .int()
    .min(0)
    .max(80)
    .nullable()
    .optional()
    .default(null),
  skills: z.array(z.string().max(100)).max(50).optional().default([]),
  industries: z.array(z.string().max(100)).max(50).optional().default([]),
  work_experience: z
    .array(workExperienceRoleSchema)
    .max(3)
    .optional()
    .default([]),
  education: educationSchema.optional().default({}),
  job_titles_seeking: z
    .array(z.string().max(200))
    .max(20)
    .optional()
    .default([]),
  remote_preference: z
    .enum(["any", "remote", "hybrid", "onsite"])
    .nullable()
    .optional()
    .default(null),
  preferred_locations: z
    .array(z.string().max(200))
    .max(20)
    .optional()
    .default([]),
  salary_expectation: z
    .string()
    .max(100)
    .nullable()
    .optional()
    .default(null)
    .describe("Market salary band inferred from experience and skills"),
  linkedin_url: optionalHttpUrl.optional().default(null),
  portfolio_url: optionalHttpUrl.optional().default(null),
  work_authorization: z
    .enum(["citizen", "permanent_resident", "visa_required"])
    .nullable()
    .optional()
    .default(null),
});

export type ProfileExtract = z.infer<typeof profileExtractSchema>;

export function isResumeTextTooShort(text: string): boolean {
  return text.trim().length < MIN_RESUME_TEXT_LENGTH;
}

function nonEmptyString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mergeEducation(
  existing: Profile["education"],
  incoming: ProfileExtract["education"],
): Profile["education"] {
  return {
    degree:
      normalizeHighestDegree(incoming.degree) ||
      existing.degree ||
      undefined,
    field_of_study:
      incoming.field_of_study?.trim() || existing.field_of_study,
    institution: incoming.institution?.trim() || existing.institution,
    graduation_year:
      incoming.graduation_year?.trim() || existing.graduation_year,
  };
}

/**
 * Clear all editable profile form fields while keeping resume + identity metadata.
 * Preserves: id, email, resume_pdf_url, is_complete, created_at, updated_at.
 */
export function clearProfileFormFields(profile: Profile): Profile {
  return {
    ...profile,
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
    cover_letter_tone: null,
    linkedin_url: null,
    portfolio_url: null,
    work_authorization: null,
  };
}

/**
 * Merge AI extraction into profile form state.
 * Never overwrites id, email, resume_pdf_url, is_complete, cover_letter_tone, or timestamps.
 * Education merges field-by-field so partial extracts do not wipe existing values.
 */
export function mergeExtractedIntoProfile(
  profile: Profile,
  extracted: ProfileExtract,
): Profile {
  const nextName = nonEmptyString(extracted.full_name);
  const nextPhone = nonEmptyString(extracted.phone);
  const nextLocation = nonEmptyString(extracted.location);
  const nextTitle = nonEmptyString(extracted.current_title);
  const nextSalary = nonEmptyString(extracted.salary_expectation);
  const nextLinkedin = nonEmptyString(extracted.linkedin_url);
  const nextPortfolio = nonEmptyString(extracted.portfolio_url);

  return {
    ...profile,
    full_name: nextName ?? profile.full_name,
    phone: nextPhone ?? profile.phone,
    location: nextLocation ?? profile.location,
    current_title: nextTitle ?? profile.current_title,
    experience_level:
      extracted.experience_level ?? profile.experience_level,
    years_experience:
      extracted.years_experience ?? profile.years_experience,
    skills:
      extracted.skills.length > 0 ? [...extracted.skills] : profile.skills,
    industries:
      extracted.industries.length > 0
        ? [...extracted.industries]
        : profile.industries,
    work_experience:
      extracted.work_experience.length > 0
        ? extracted.work_experience.map((role) => ({
            ...role,
            start_date: normalizeDateToYearMonth(role.start_date) || role.start_date,
            end_date: role.is_current
              ? null
              : normalizeDateToYearMonth(role.end_date) || role.end_date,
            responsibilities: asResponsibilities(role.responsibilities),
          }))
        : profile.work_experience,
    education: mergeEducation(profile.education, extracted.education),
    job_titles_seeking:
      extracted.job_titles_seeking.length > 0
        ? [...extracted.job_titles_seeking]
        : profile.job_titles_seeking,
    remote_preference:
      extracted.remote_preference ?? profile.remote_preference,
    preferred_locations:
      extracted.preferred_locations.length > 0
        ? [...extracted.preferred_locations]
        : profile.preferred_locations,
    salary_expectation: nextSalary ?? profile.salary_expectation,
    linkedin_url: nextLinkedin ?? profile.linkedin_url,
    portfolio_url: nextPortfolio ?? profile.portfolio_url,
    work_authorization:
      extracted.work_authorization ?? profile.work_authorization,
  };
}
