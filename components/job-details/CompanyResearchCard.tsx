"use client";

import {
    AlertTriangle,
    Building2,
    ClipboardList,
    Code2,
    Link2,
    MessageCircleQuestion,
    Search,
    Sparkles,
    Target,
    Users,
    type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MultiStepProgress } from "@/components/ui/multi-step-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { captureEvent } from "@/lib/analytics";
import { playCompletionSound } from "@/lib/completion-sound";
import { displayCompany } from "@/lib/job-detail";
import {
    notifyResumeAiUsageRefresh,
    researchCompanyForJob,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";
import type { CompanyResearch } from "@/types";

type CompanyResearchCardProps = {
  jobId: string;
  company: string | null;
  research: CompanyResearch | null;
  onResearched?: (research: CompanyResearch) => void;
};

export const RESEARCH_STATUS_MESSAGES = [
  "Resolve company homepage",
  "Browse public pages",
  "Build interview dossier",
  "Save research",
] as const;

const STEP_INTERVAL_MS = 15_000;

function DossierCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-muted/60 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-accent"
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-text-dark">
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-text-secondary">—</p>;
  }
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, index) => (
        <li key={`${index}:${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-text-secondary">—</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <li
          key={`${index}:${item}`}
          className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-dark"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function CompanyResearchDossier({
  research,
  reveal,
}: {
  research: CompanyResearch;
  /** Only true when the dossier just arrived from a run in this session. */
  reveal: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-4 grid gap-3 sm:grid-cols-2",
        reveal && "jp-reveal",
      )}
    >
      <DossierCard
        title="Company Overview"
        icon={Building2}
        className="sm:col-span-2"
      >
        <p>{research.companyOverview}</p>
      </DossierCard>
      <DossierCard title="Tech Stack" icon={Code2}>
        <TagList items={research.techStack} />
      </DossierCard>
      <DossierCard title="Culture" icon={Users}>
        <BulletList items={research.culture} />
      </DossierCard>
      <DossierCard
        title="Why This Role"
        icon={Target}
        className="sm:col-span-2"
      >
        <p>{research.whyThisRole}</p>
      </DossierCard>
      <DossierCard title="Your Edge" icon={Sparkles}>
        <BulletList items={research.yourEdge} />
      </DossierCard>
      <DossierCard title="Gaps to Address" icon={AlertTriangle}>
        <BulletList items={research.gapsToAddress} />
      </DossierCard>
      <DossierCard title="Smart Questions" icon={MessageCircleQuestion}>
        <BulletList items={research.smartQuestions} />
      </DossierCard>
      <DossierCard title="Interview Prep" icon={ClipboardList}>
        <BulletList items={research.interviewPrep} />
      </DossierCard>
      {research.sources.length > 0 ? (
        <DossierCard
          title="Sources"
          icon={Link2}
          className="sm:col-span-2"
        >
          <ul className="space-y-1.5 text-xs text-text-secondary">
            {research.sources.map((source) => (
              <li key={source}>
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer break-all text-accent hover:text-accent-dark hover:underline"
                >
                  {source}
                </a>
              </li>
            ))}
          </ul>
        </DossierCard>
      ) : null}
    </div>
  );
}

function CompanyResearchSkeleton() {
  return (
    <div
      className="mt-4 grid gap-3 sm:grid-cols-2"
      aria-busy
      aria-label="Loading company research"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className={cn(
            "rounded-lg border border-border bg-surface-muted/60 p-4",
            index === 0 || index === 5 ? "sm:col-span-2" : undefined,
          )}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompanyResearchCard({
  jobId,
  company,
  research,
  onResearched,
}: CompanyResearchCardProps) {
  const companyLabel = displayCompany(company);
  const [pending, setPending] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [localResearch, setLocalResearch] = useState<CompanyResearch | null>(
    research,
  );
  /* Research already on the job rides the page cascade; only a fresh run reveals. */
  const [justResearched, setJustResearched] = useState(false);

  useEffect(() => {
    setLocalResearch(research);
  }, [research]);

  useEffect(() => {
    if (!pending) {
      setStepIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setStepIndex((current) =>
        Math.min(current + 1, RESEARCH_STATUS_MESSAGES.length - 1),
      );
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pending]);

  const displayed = localResearch ?? research;

  const handleResearch = async () => {
    if (pending) return;
    setPending(true);
    setStepIndex(0);
    try {
      const result = await researchCompanyForJob(jobId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setStepIndex(RESEARCH_STATUS_MESSAGES.length - 1);
      setJustResearched(true);
      setLocalResearch(result.data.research);
      onResearched?.(result.data.research);
      captureEvent("company_researched", {
        jobId,
        company: company ?? undefined,
      });
      notifyResumeAiUsageRefresh();
      playCompletionSound();

      if (result.data.degraded) {
        toast.info(
          `Briefing for ${companyLabel} used limited sources — review the posting carefully.`,
        );
      } else if (result.data.browsed) {
        toast.success(`Research ready for ${companyLabel}.`);
      } else {
        toast.success(
          `Briefing ready for ${companyLabel} (limited web sources).`,
        );
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Building2
            className="size-4 shrink-0 text-text-secondary"
            aria-hidden
          />
          <h2 className="text-base font-semibold text-text-primary">
            Company Research
          </h2>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 cursor-pointer"
          pending={pending}
          disabled={pending}
          onClick={() => {
            void handleResearch();
          }}
        >
          <Search className="size-3.5" aria-hidden />
          Research Company
        </Button>
      </div>

      {pending ? (
        <>
          <MultiStepProgress
            steps={RESEARCH_STATUS_MESSAGES}
            currentIndex={stepIndex}
          />
          <CompanyResearchSkeleton />
        </>
      ) : displayed ? (
        <CompanyResearchDossier research={displayed} reveal={justResearched} />
      ) : (
        <div className="mt-8 flex flex-col items-center px-4 pb-4 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-full bg-surface-muted text-text-muted"
            aria-hidden
          >
            <Building2 className="size-7" />
          </div>
          <p className="mt-4 text-base font-semibold text-text-primary">
            No research yet
          </p>
          <p className="mt-1.5 max-w-md text-sm text-text-secondary">
            Click &quot;Research Company&quot; to let the AI browse{" "}
            {companyLabel}&apos;s public pages and build a dossier.
          </p>
        </div>
      )}
    </section>
  );
}
