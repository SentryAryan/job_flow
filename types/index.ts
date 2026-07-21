export type WorkExperienceRole = {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  responsibilities: string;
};

export type Education = {
  degree: string;
  field_of_study: string;
  institution: string;
  graduation_year: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  experience_level: string | null;
  years_experience: number | null;
  skills: string[];
  industries: string[];
  work_experience: WorkExperienceRole[];
  education: Partial<Education>;
  job_titles_seeking: string[];
  remote_preference: string | null;
  preferred_locations: string[];
  salary_expectation: string | null;
  cover_letter_tone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  work_authorization: string | null;
  resume_pdf_url: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type AgentRunStatus = "running" | "completed" | "failed";

export type AgentRun = {
  id: string;
  user_id: string;
  status: AgentRunStatus;
  job_title_searched: string | null;
  location_searched: string | null;
  jobs_found: number;
  started_at: string;
  completed_at: string | null;
};

export type JobSource = "search" | "url";

export type CompanyResearch = {
  companyOverview: string;
  techStack: string[];
  culture: string[];
  whyThisRole: string;
  yourEdge: string[];
  gapsToAddress: string[];
  smartQuestions: string[];
  interviewPrep: string[];
  sources: string[];
};

export type Job = {
  id: string;
  run_id: string | null;
  user_id: string;
  source: JobSource;
  source_url: string | null;
  external_apply_url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  about_role: string | null;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  benefits: string[];
  about_company: string | null;
  match_score: number | null;
  match_reason: string | null;
  matched_skills: string[];
  missing_skills: string[];
  company_research: CompanyResearch | null;
  found_at: string;
};

export type AgentLogLevel = "info" | "success" | "warning" | "error";

export type AgentLog = {
  id: string;
  run_id: string;
  user_id: string;
  message: string;
  level: AgentLogLevel;
  job_id: string | null;
  created_at: string;
};
