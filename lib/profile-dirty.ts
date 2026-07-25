import type { Profile } from "@/types";

/**
 * Fields that affect resume generation / profile content.
 * Ignores resume_pdf_url, timestamps, and is_complete so upload/preview
 * refresh does not mark the form dirty.
 */
function snapshotForDirtyCompare(profile: Profile): unknown {
  return {
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    current_title: profile.current_title,
    experience_level: profile.experience_level,
    years_experience: profile.years_experience,
    skills: profile.skills,
    industries: profile.industries,
    work_experience: profile.work_experience,
    education: profile.education,
    job_titles_seeking: profile.job_titles_seeking,
    remote_preference: profile.remote_preference,
    preferred_locations: profile.preferred_locations,
    salary_expectation: profile.salary_expectation,
    cover_letter_tone: profile.cover_letter_tone,
    linkedin_url: profile.linkedin_url,
    portfolio_url: profile.portfolio_url,
    work_authorization: profile.work_authorization,
  };
}

/** True when current form content differs from the last saved/loaded baseline. */
export function isProfileDirty(
  current: Profile,
  baseline: Profile | null,
): boolean {
  if (!baseline) return true;
  return (
    JSON.stringify(snapshotForDirtyCompare(current)) !==
    JSON.stringify(snapshotForDirtyCompare(baseline))
  );
}
