import type { Profile } from "@/types";

/** Mock profile for Feature 05 UI. Phone, location, and education incomplete → ~70%. */
export const MOCK_PROFILE: Profile = {
  id: "mock-user-id",
  full_name: "Faizan Ali",
  email: "faizan@jamastary.pro",
  phone: null,
  location: null,
  current_title: "Frontend Engineer",
  experience_level: "junior",
  years_experience: 4,
  skills: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
  industries: [],
  work_experience: [
    {
      company: "Vercel",
      title: "Frontend Engineer",
      start_date: "2022-01",
      end_date: null,
      is_current: true,
      responsibilities:
        "Built front-end features and optimized Core Web Vitals. Lead a team of 3 developers.",
    },
  ],
  education: {
    degree: "High School",
    field_of_study: "Computer Science",
    institution: "",
    graduation_year: "",
  },
  job_titles_seeking: ["Frontend engineer", "react developer"],
  remote_preference: "any",
  preferred_locations: [],
  salary_expectation: null,
  cover_letter_tone: null,
  linkedin_url: "https://linkedin.com/in/faizan",
  portfolio_url: "https://github.com/jahanshery",
  work_authorization: "citizen",
  resume_pdf_url: null,
  is_complete: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};
