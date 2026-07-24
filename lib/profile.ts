import { z } from "zod";

import { errorMessage, isNotFoundError, isTransientError } from "@/lib/errors";
import { insforge } from "@/lib/insforge-client";
import { getProfileCompletion } from "@/lib/profile-completion";
import {
    extractStorageObjectKey,
    resolveResumeStorageKey,
    resumeObjectKey,
} from "@/lib/storage-keys";
import type { Profile, WorkExperienceRole } from "@/types";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function isOptionalHttpUrl(value: string | null): boolean {
  if (value == null || value.trim() === "") return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const optionalHttpUrl = z
  .string()
  .max(500)
  .nullable()
  .refine(isOptionalHttpUrl, { message: "Enter a valid http(s) URL" });

const workExperienceRoleSchema = z.object({
  company: z.string().max(200),
  title: z.string().max(200),
  start_date: z.string().max(20),
  end_date: z.string().max(20).nullable(),
  is_current: z.boolean(),
  responsibilities: z.string().max(5000),
});

const educationSchema = z.object({
  degree: z.string().max(100).optional(),
  field_of_study: z.string().max(200).optional(),
  institution: z.string().max(200).optional(),
  graduation_year: z.string().max(10).optional(),
});

export const profileSaveSchema = z.object({
  full_name: z.string().max(200).nullable(),
  phone: z.string().max(50).nullable(),
  location: z.string().max(200).nullable(),
  current_title: z.string().max(200).nullable(),
  experience_level: z
    .enum(["junior", "mid", "senior", "lead"])
    .nullable(),
  years_experience: z.number().int().min(0).max(80).nullable(),
  skills: z.array(z.string().max(100)).max(50),
  industries: z.array(z.string().max(100)).max(50),
  work_experience: z.array(workExperienceRoleSchema).max(3),
  education: educationSchema,
  job_titles_seeking: z.array(z.string().max(200)).max(20),
  remote_preference: z
    .enum(["any", "remote", "hybrid", "onsite"])
    .nullable(),
  preferred_locations: z.array(z.string().max(200)).max(20),
  salary_expectation: z.string().max(100).nullable(),
  linkedin_url: optionalHttpUrl,
  portfolio_url: optionalHttpUrl,
  work_authorization: z
    .enum(["citizen", "permanent_resident", "visa_required"])
    .nullable(),
});

export type ProfileSaveInput = z.infer<typeof profileSaveSchema>;

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asWorkExperience(value: unknown): WorkExperienceRole[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        company: typeof row.company === "string" ? row.company : "",
        title: typeof row.title === "string" ? row.title : "",
        start_date: typeof row.start_date === "string" ? row.start_date : "",
        end_date:
          row.end_date === null
            ? null
            : typeof row.end_date === "string"
              ? row.end_date
              : null,
        is_current: Boolean(row.is_current),
        responsibilities:
          typeof row.responsibilities === "string" ? row.responsibilities : "",
      } satisfies WorkExperienceRole;
    })
    .filter((role): role is WorkExperienceRole => role !== null);
}

function asEducation(value: unknown): Profile["education"] {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return {
    degree: typeof row.degree === "string" ? row.degree : undefined,
    field_of_study:
      typeof row.field_of_study === "string" ? row.field_of_study : undefined,
    institution:
      typeof row.institution === "string" ? row.institution : undefined,
    graduation_year:
      typeof row.graduation_year === "string" ? row.graduation_year : undefined,
  };
}

function mapRowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    email: typeof row.email === "string" ? row.email : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    location: typeof row.location === "string" ? row.location : null,
    current_title:
      typeof row.current_title === "string" ? row.current_title : null,
    experience_level:
      typeof row.experience_level === "string" ? row.experience_level : null,
    years_experience:
      typeof row.years_experience === "number" ? row.years_experience : null,
    skills: asStringArray(row.skills),
    industries: asStringArray(row.industries),
    work_experience: asWorkExperience(row.work_experience),
    education: asEducation(row.education),
    job_titles_seeking: asStringArray(row.job_titles_seeking),
    remote_preference:
      typeof row.remote_preference === "string" ? row.remote_preference : null,
    preferred_locations: asStringArray(row.preferred_locations),
    salary_expectation:
      typeof row.salary_expectation === "string"
        ? row.salary_expectation
        : null,
    cover_letter_tone:
      typeof row.cover_letter_tone === "string" ? row.cover_letter_tone : null,
    linkedin_url:
      typeof row.linkedin_url === "string" ? row.linkedin_url : null,
    portfolio_url:
      typeof row.portfolio_url === "string" ? row.portfolio_url : null,
    work_authorization:
      typeof row.work_authorization === "string"
        ? row.work_authorization
        : null,
    resume_pdf_url:
      typeof row.resume_pdf_url === "string" ? row.resume_pdf_url : null,
    is_complete: Boolean(row.is_complete),
    created_at:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
    updated_at:
      typeof row.updated_at === "string"
        ? row.updated_at
        : new Date().toISOString(),
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function userFacingTimeoutMessage(
  error: unknown,
  timeoutMessage: string,
  fallback: string,
): string {
  return isTransientError(error) ? timeoutMessage : fallback;
}

function firstValidationMessage(
  error: z.ZodError,
  fallback: string,
): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  if (
    issue.path.includes("linkedin_url") ||
    issue.path.includes("portfolio_url")
  ) {
    return "Enter a valid LinkedIn or portfolio URL";
  }
  return issue.message || fallback;
}

export async function fetchProfile(
  userId: string,
): Promise<ActionResult<Profile>> {
  try {
    const { data, error } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[lib/profile] fetchProfile", error);
      return {
        success: false,
        error: userFacingTimeoutMessage(
          error,
          "Request timed out. Please try again.",
          "Failed to load profile",
        ),
      };
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "Profile not found" };
    }

    return {
      success: true,
      data: mapRowToProfile(data as Record<string, unknown>),
    };
  } catch (error) {
    console.error("[lib/profile] fetchProfile", error);
    return {
      success: false,
      error: userFacingTimeoutMessage(
        error,
        "Request timed out. Please try again.",
        "Failed to load profile",
      ),
    };
  }
}

export async function saveProfile(
  userId: string,
  input: ProfileSaveInput,
  context: {
    email: string | null;
    resume_pdf_url: string | null;
    cover_letter_tone: string | null;
  },
): Promise<ActionResult<Profile>> {
  try {
    const parsed = profileSaveSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: firstValidationMessage(
          parsed.error,
          "Please check the form fields and try again",
        ),
      };
    }

    const payload = parsed.data;
    const draftForCompletion: Profile = {
      id: userId,
      full_name: emptyToNull(payload.full_name),
      email: context.email,
      phone: emptyToNull(payload.phone),
      location: emptyToNull(payload.location),
      current_title: emptyToNull(payload.current_title),
      experience_level: payload.experience_level,
      years_experience: payload.years_experience,
      skills: payload.skills,
      industries: payload.industries,
      work_experience: payload.work_experience,
      education: payload.education,
      job_titles_seeking: payload.job_titles_seeking,
      remote_preference: payload.remote_preference,
      preferred_locations: payload.preferred_locations,
      salary_expectation: emptyToNull(payload.salary_expectation),
      cover_letter_tone: context.cover_letter_tone,
      linkedin_url: emptyToNull(payload.linkedin_url),
      portfolio_url: emptyToNull(payload.portfolio_url),
      work_authorization: payload.work_authorization,
      resume_pdf_url: context.resume_pdf_url,
      is_complete: false,
      created_at: "",
      updated_at: "",
    };

    const completion = getProfileCompletion(draftForCompletion);
    const is_complete = completion.missing.length === 0;

    const { data, error } = await insforge.database
      .from("profiles")
      .update({
        full_name: emptyToNull(payload.full_name),
        phone: emptyToNull(payload.phone),
        location: emptyToNull(payload.location),
        current_title: emptyToNull(payload.current_title),
        experience_level: payload.experience_level,
        years_experience: payload.years_experience,
        skills: payload.skills,
        industries: payload.industries,
        work_experience: payload.work_experience,
        education: payload.education,
        job_titles_seeking: payload.job_titles_seeking,
        remote_preference: payload.remote_preference,
        preferred_locations: payload.preferred_locations,
        salary_expectation: emptyToNull(payload.salary_expectation),
        linkedin_url: emptyToNull(payload.linkedin_url),
        portfolio_url: emptyToNull(payload.portfolio_url),
        work_authorization: payload.work_authorization,
        is_complete,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      console.error("[lib/profile] saveProfile", error);
      return {
        success: false,
        error: userFacingTimeoutMessage(
          error,
          "Save timed out. Please try again.",
          "Failed to save profile",
        ),
      };
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "Failed to save profile" };
    }

    return {
      success: true,
      data: mapRowToProfile(data as Record<string, unknown>),
    };
  } catch (error) {
    console.error("[lib/profile] saveProfile", error);
    return {
      success: false,
      error: userFacingTimeoutMessage(
        error,
        "Save timed out. Please try again.",
        "Failed to save profile",
      ),
    };
  }
}

async function removeResumeKeys(keys: Iterable<string>): Promise<void> {
  const bucket = insforge.storage.from("resumes");
  for (const key of keys) {
    const { error } = await bucket.remove(key);
    if (!error) continue;
    // InsForge may already have moved/replaced the object during collision rename.
    if (isNotFoundError(error)) continue;
    console.error("[lib/profile] uploadResume remove", key, errorMessage(error));
  }
}

function normalizePdfFile(file: File): File {
  if (file.type === "application/pdf") return file;
  return new File([file], file.name, { type: "application/pdf" });
}

function staleKeysForReplace(
  userId: string,
  previousUrl: string | null | undefined,
): Set<string> {
  const keys = new Set<string>([resumeObjectKey(userId)]);
  if (previousUrl) {
    const previousKey = extractStorageObjectKey(previousUrl);
    if (previousKey) keys.add(previousKey);
  }
  return keys;
}

async function storageUploadResume(
  key: string,
  file: File,
): Promise<{ data: { url?: string; key?: string } | null; error: unknown }> {
  return insforge.storage.from("resumes").upload(key, file);
}

export async function uploadResume(
  userId: string,
  file: File,
  options?: { previousUrl?: string | null },
): Promise<ActionResult<{ profile: Profile; url: string }>> {
  try {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return { success: false, error: "Only PDF files are allowed" };
    }
    if (file.size > MAX_RESUME_BYTES) {
      return { success: false, error: "Maximum file size is 5MB" };
    }

    const key = resumeObjectKey(userId);
    const pdfFile = normalizePdfFile(file);

    // Upload first — never delete the existing object until a new upload succeeds.
    let { data: uploadData, error: uploadError } = await storageUploadResume(
      key,
      pdfFile,
    );

    // One retry on transient failure; on re-upload, clear stale keys first so
    // InsForge does not spend time on collision rename paths.
    if (uploadError && isTransientError(uploadError)) {
      if (options?.previousUrl) {
        await removeResumeKeys(staleKeysForReplace(userId, options.previousUrl));
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      const retry = await storageUploadResume(key, pdfFile);
      uploadData = retry.data;
      uploadError = retry.error;
    }

    if (uploadError || !uploadData?.url) {
      console.error("[lib/profile] uploadResume storage", uploadError);
      return {
        success: false,
        error: userFacingTimeoutMessage(
          uploadError,
          "Upload timed out. Check your connection and try again.",
          "Failed to upload resume",
        ),
      };
    }

    const { data, error } = await insforge.database
      .from("profiles")
      .update({ resume_pdf_url: uploadData.url })
      .eq("id", userId)
      .select("*")
      .single();

    if (error || !data || typeof data !== "object") {
      console.error("[lib/profile] uploadResume db", error);
      return { success: false, error: "Failed to save resume URL" };
    }

    const uploadedKey =
      typeof uploadData.key === "string" && uploadData.key.length > 0
        ? uploadData.key
        : extractStorageObjectKey(uploadData.url);
    const staleKeys = new Set<string>();
    if (options?.previousUrl) {
      const previousKey = extractStorageObjectKey(options.previousUrl);
      if (previousKey && previousKey !== uploadedKey) {
        staleKeys.add(previousKey);
      }
    }
    if (uploadedKey && uploadedKey !== key) {
      // New object landed under a renamed key — clear the stale canonical path if present.
      staleKeys.add(key);
    }
    if (staleKeys.size > 0) {
      await removeResumeKeys(staleKeys);
    }

    return {
      success: true,
      data: {
        profile: mapRowToProfile(data as Record<string, unknown>),
        url: uploadData.url,
      },
    };
  } catch (error) {
    console.error("[lib/profile] uploadResume", error);
    return {
      success: false,
      error: userFacingTimeoutMessage(
        error,
        "Upload timed out. Check your connection and try again.",
        "Failed to upload resume",
      ),
    };
  }
}

export async function fetchResumeBlob(
  userId: string,
  resumePdfUrl: string | null | undefined,
): Promise<ActionResult<Blob>> {
  try {
    if (!resumePdfUrl) {
      return { success: false, error: "No resume on file" };
    }

    const key = resolveResumeStorageKey(userId, resumePdfUrl);
    if (!key) {
      return { success: false, error: "Invalid resume location" };
    }

    const { data, error } = await insforge.storage
      .from("resumes")
      .download(key);

    if (error || !data) {
      console.error("[lib/profile] fetchResumeBlob", error);
      return {
        success: false,
        error: userFacingTimeoutMessage(
          error,
          "Request timed out. Please try again.",
          "Failed to load resume",
        ),
      };
    }

    // Storage may return an untyped blob — without application/pdf the browser
    // downloads an unnamed UUID file instead of rendering a preview.
    const pdfBlob =
      data.type === "application/pdf"
        ? data
        : new Blob([data], { type: "application/pdf" });

    return { success: true, data: pdfBlob };
  } catch (error) {
    console.error("[lib/profile] fetchResumeBlob", error);
    return {
      success: false,
      error: userFacingTimeoutMessage(
        error,
        "Request timed out. Please try again.",
        "Failed to load resume",
      ),
    };
  }
}

const COMPLETE_YEAR_MONTH = /^\d{4}-\d{2}$/;

function normalizeYearMonth(value: string): string {
  return COMPLETE_YEAR_MONTH.test(value) ? value : "";
}

function normalizeEndDate(value: string | null): string | null {
  if (value == null || value === "") return null;
  return COMPLETE_YEAR_MONTH.test(value) ? value : null;
}

export function profileToSaveInput(profile: Profile): ProfileSaveInput {
  return {
    full_name: profile.full_name,
    phone: profile.phone,
    location: profile.location,
    current_title: profile.current_title,
    experience_level:
      profile.experience_level === "junior" ||
      profile.experience_level === "mid" ||
      profile.experience_level === "senior" ||
      profile.experience_level === "lead"
        ? profile.experience_level
        : null,
    years_experience: profile.years_experience,
    skills: profile.skills,
    industries: profile.industries,
    work_experience: profile.work_experience.map((role: WorkExperienceRole) => ({
      ...role,
      start_date: normalizeYearMonth(role.start_date),
      end_date: normalizeEndDate(role.end_date),
    })),
    education: profile.education,
    job_titles_seeking: profile.job_titles_seeking,
    remote_preference:
      profile.remote_preference === "any" ||
      profile.remote_preference === "remote" ||
      profile.remote_preference === "hybrid" ||
      profile.remote_preference === "onsite"
        ? profile.remote_preference
        : null,
    preferred_locations: profile.preferred_locations,
    salary_expectation: profile.salary_expectation,
    linkedin_url: profile.linkedin_url,
    portfolio_url: profile.portfolio_url,
    work_authorization:
      profile.work_authorization === "citizen" ||
      profile.work_authorization === "permanent_resident" ||
      profile.work_authorization === "visa_required"
        ? profile.work_authorization
        : null,
  };
}
