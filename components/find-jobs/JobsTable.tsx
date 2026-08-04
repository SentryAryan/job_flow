"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { MatchScoreBar } from "@/components/find-jobs/MatchScoreBar";
import {
    formatRelativeFoundAt,
    type JobListRow,
} from "@/lib/find-jobs-list";
import { cn } from "@/lib/utils";

const COLUMNS = [
  "Company",
  "Role",
  "Match Score",
  "Salary Est.",
  "Date Found",
  "Details",
] as const;

type JobsTableProps = {
  jobs: readonly JobListRow[];
  emptyMessage?: string;
  className?: string;
};

export function JobsTable({
  jobs,
  emptyMessage = "No jobs match your filters. Try adjusting search or match level.",
  className,
}: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className={cn("px-6 py-16 text-center", className)}>
        <p className="text-sm text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className={cn(
                  "px-4 py-3 text-[11px] font-medium tracking-wide text-text-secondary uppercase sm:px-5",
                  column === "Details" && "text-right",
                )}
              >
                {column === "Details" ? (
                  <span className="sr-only">Details</span>
                ) : (
                  column
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-b border-border last:border-b-0 transition-colors hover:bg-surface-secondary"
            >
              <td className="p-0">
                <Link
                  href={`/find-jobs/${job.id}`}
                  className="flex cursor-pointer items-center gap-2.5 px-4 py-3.5 text-sm font-semibold text-text-primary sm:px-5"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-tertiary text-xs font-semibold text-text-secondary"
                    aria-hidden
                  >
                    {job.company.charAt(0)}
                  </span>
                  {job.company}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/find-jobs/${job.id}`}
                  className="block cursor-pointer px-4 py-3.5 text-sm text-text-secondary sm:px-5"
                >
                  {job.title}
                </Link>
              </td>
              <td className="px-4 py-3.5 sm:px-5">
                <MatchScoreBar score={job.match_score} />
              </td>
              <td className="px-4 py-3.5 text-sm text-text-secondary sm:px-5">
                {job.salary}
              </td>
              <td className="px-4 py-3.5 text-sm text-text-muted sm:px-5">
                {formatRelativeFoundAt(job.found_at)}
              </td>
              <td className="px-4 py-3.5 text-right sm:px-5">
                <Link
                  href={`/find-jobs/${job.id}`}
                  aria-label={`View details for ${job.title} at ${job.company}`}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:border-accent hover:bg-accent-light hover:text-accent"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
