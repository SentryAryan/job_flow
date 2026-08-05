"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { AiMatchReasoning } from "@/components/job-details/AiMatchReasoning";
import { ApplyNowButton } from "@/components/job-details/ApplyNowButton";
import { BackToJobs } from "@/components/job-details/BackToJobs";
import { CompanyResearchCard } from "@/components/job-details/CompanyResearchCard";
import { JobDescription } from "@/components/job-details/JobDescription";
import { JobDetailsNotFound } from "@/components/job-details/JobDetailsNotFound";
import { JobDetailsSkeleton } from "@/components/job-details/JobDetailsSkeleton";
import { JobHeader } from "@/components/job-details/JobHeader";
import { JobMetaCards } from "@/components/job-details/JobMetaCards";
import { SkillsComparison } from "@/components/job-details/SkillsComparison";
import Navbar from "@/components/layout/Navbar";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { getApplyUrl } from "@/lib/job-detail";
import { fetchJobById } from "@/lib/jobs";
import type { Job } from "@/types";

function JobDetailsContent({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    const result = await fetchJobById(jobId);
    if (!result.success) {
      if (result.status === 404) {
        setJob(null);
        setNotFound(true);
      } else {
        setJob(null);
        setError(result.error);
        toast.error(result.error);
      }
      setLoading(false);
      return;
    }

    setJob(result.data);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <JobDetailsSkeleton />;
  }

  if (notFound) {
    return <JobDetailsNotFound />;
  }

  if (error || !job) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8">
        <BackToJobs />
        <section className="rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-text-secondary">
            {error ?? "Could not load this job."}
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              void load();
            }}
          >
            Try again
          </Button>
        </section>
      </main>
    );
  }

  const applyUrl = getApplyUrl(job);

  /*
    Sections reveal top-to-bottom as the fetch resolves. Eight steps at
    REVEAL_STAGGER_MS keeps the last one under ~300ms, so the page still reads
    as one arrival rather than a slow drip.
  */
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8">
      <Reveal step={0}>
        <BackToJobs />
      </Reveal>
      <Reveal step={1}>
        <JobHeader
          title={job.title}
          company={job.company}
          matchScore={job.match_score}
          viewUrl={applyUrl}
        />
      </Reveal>
      <Reveal step={2}>
        <JobMetaCards
          salary={job.salary}
          location={job.location}
          jobType={job.job_type}
          foundAt={job.found_at}
        />
      </Reveal>
      <Reveal step={3}>
        <AiMatchReasoning matchReason={job.match_reason} />
      </Reveal>
      <Reveal step={4}>
        <SkillsComparison
          matchedSkills={job.matched_skills}
          missingSkills={job.missing_skills}
        />
      </Reveal>
      <Reveal step={5}>
        <JobDescription
          aboutRole={job.about_role}
          responsibilities={job.responsibilities}
          requirements={job.requirements}
          niceToHave={job.nice_to_have}
          benefits={job.benefits}
          aboutCompany={job.about_company}
          viewUrl={applyUrl}
        />
      </Reveal>
      <Reveal step={6}>
        <CompanyResearchCard
          jobId={job.id}
          company={job.company}
          research={job.company_research}
          onResearched={(research) => {
            setJob((prev) =>
              prev ? { ...prev, company_research: research } : prev,
            );
          }}
        />
      </Reveal>
      <Reveal step={7}>
        <ApplyNowButton company={job.company} applyUrl={applyUrl} />
      </Reveal>
    </main>
  );
}

function JobDetailsPageInner() {
  const params = useParams<{ id: string }>();
  const jobId = typeof params.id === "string" ? params.id.trim() : "";

  if (!jobId) {
    return <JobDetailsNotFound message="Missing job id." />;
  }

  return <JobDetailsContent jobId={jobId} />;
}

export default function JobDetailsPage() {
  return (
    <AuthGuard fallback={<JobDetailsSkeleton />}>
      <div className="min-h-screen bg-background">
        <Navbar />
        <JobDetailsPageInner />
      </div>
    </AuthGuard>
  );
}
