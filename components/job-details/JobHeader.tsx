import { Building2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    displayCompany,
    displayTitle,
    getMatchBadgeClass,
} from "@/lib/job-detail";
import { cn } from "@/lib/utils";

type JobHeaderProps = {
  title: string | null;
  company: string | null;
  matchScore: number | null;
  viewUrl: string | null;
};

export function JobHeader({
  title,
  company,
  matchScore,
  viewUrl,
}: JobHeaderProps) {
  const companyLabel = displayCompany(company);
  const titleLabel = displayTitle(title);
  const score =
    typeof matchScore === "number" && Number.isFinite(matchScore)
      ? matchScore
      : null;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary text-text-muted"
            aria-hidden
          >
            <Building2 className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              {titleLabel}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-text-secondary">
              <span>{companyLabel}</span>
              {score != null ? (
                <>
                  <span className="text-text-muted" aria-hidden>
                    ·
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      getMatchBadgeClass(score),
                    )}
                  >
                    {score}% Match Score
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {viewUrl ? (
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              View Job Post
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
