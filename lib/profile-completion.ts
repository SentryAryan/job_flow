import type { Profile } from "@/types";

export type MissingFieldTag =
  | "PHONE"
  | "LOCATION"
  | "EDUCATION"
  | "FULL NAME"
  | "EMAIL"
  | "JOB TITLE"
  | "EXPERIENCE"
  | "SKILLS"
  | "WORK EXPERIENCE"
  | "JOB PREFERENCES";

export type ProfileCompletion = {
  percent: number;
  missing: MissingFieldTag[];
};

type Check = {
  tag: MissingFieldTag;
  ok: (profile: Profile) => boolean;
};

const CHECKS: Check[] = [
  {
    tag: "FULL NAME",
    ok: (p) => Boolean(p.full_name?.trim()),
  },
  {
    tag: "EMAIL",
    ok: (p) => Boolean(p.email?.trim()),
  },
  {
    tag: "PHONE",
    ok: (p) => Boolean(p.phone?.trim()),
  },
  {
    tag: "LOCATION",
    ok: (p) => Boolean(p.location?.trim()),
  },
  {
    tag: "JOB TITLE",
    ok: (p) => Boolean(p.current_title?.trim()),
  },
  {
    tag: "EXPERIENCE",
    ok: (p) =>
      Boolean(p.experience_level?.trim()) && p.years_experience != null,
  },
  {
    tag: "SKILLS",
    ok: (p) => p.skills.length > 0,
  },
  {
    tag: "WORK EXPERIENCE",
    ok: (p) =>
      p.work_experience.length > 0 &&
      Boolean(p.work_experience[0]?.company?.trim()) &&
      Boolean(p.work_experience[0]?.title?.trim()),
  },
  {
    tag: "EDUCATION",
    ok: (p) =>
      Boolean(p.education.degree?.trim()) &&
      Boolean(p.education.field_of_study?.trim()) &&
      Boolean(p.education.institution?.trim()) &&
      Boolean(p.education.graduation_year?.trim()),
  },
  {
    tag: "JOB PREFERENCES",
    ok: (p) => p.job_titles_seeking.length > 0,
  },
];

export function getProfileCompletion(profile: Profile): ProfileCompletion {
  const missing = CHECKS.filter((c) => !c.ok(profile)).map((c) => c.tag);
  const filled = CHECKS.length - missing.length;
  const percent = Math.round((filled / CHECKS.length) * 100);

  return { percent, missing };
}
