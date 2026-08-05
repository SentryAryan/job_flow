"use client";

import { Search, Sparkles } from "lucide-react";

import { SearchProgressBanner } from "@/components/find-jobs/JobsLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SearchControlsProps = {
  jobTitle: string;
  location: string;
  showSuccessBanner: boolean;
  successMessage?: string;
  searching?: boolean;
  searchStatusIndex?: number;
  onJobTitleChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onFindJobs: () => void;
  className?: string;
};

export function SearchControls({
  jobTitle,
  location,
  showSuccessBanner,
  successMessage = "Found and saved 8 jobs · 4 strong matches (70%+).",
  searching = false,
  searchStatusIndex = 0,
  onJobTitleChange,
  onLocationChange,
  onFindJobs,
  className,
}: SearchControlsProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6",
        searching && "ring-1 ring-accent/20",
        className,
      )}
    >
      <form
        className="flex flex-col gap-4 lg:flex-row lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (searching) return;
          onFindJobs();
        }}
      >
        <div className="min-w-0 flex-1">
          <Label
            htmlFor="find-jobs-title"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            Job Title
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <Input
              id="find-jobs-title"
              value={jobTitle}
              onChange={(event) => onJobTitleChange(event.target.value)}
              placeholder="Any role — e.g. Nurse, Teacher, Engineer…"
              className="pl-9"
              autoComplete="off"
              disabled={searching}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <Label
            htmlFor="find-jobs-location"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            Location
          </Label>
          <Input
            id="find-jobs-location"
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
            placeholder="Remote, New York..."
            autoComplete="off"
            disabled={searching}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="shrink-0 cursor-pointer disabled:cursor-not-allowed"
          disabled={searching || !jobTitle.trim()}
          aria-busy={searching}
        >
          {searching ? (
            <Spinner size="sm" label="Searching" />
          ) : (
            <Search data-icon="inline-start" />
          )}
          {searching ? "Searching…" : "Find Jobs"}
        </Button>
      </form>

      {searching ? (
        <SearchProgressBanner currentIndex={searchStatusIndex} />
      ) : null}

      {/* Lands after a long agent run — reveal so the result doesn't just pop in. */}
      {!searching && showSuccessBanner ? (
        <div
          className="jp-reveal mt-4 flex items-center gap-2 rounded-lg bg-success-lightest px-3.5 py-2.5 text-sm font-medium text-success-darker"
          role="status"
        >
          <Sparkles className="size-4 shrink-0 text-success-darker" aria-hidden />
          <span>{successMessage}</span>
        </div>
      ) : null}
    </section>
  );
}
