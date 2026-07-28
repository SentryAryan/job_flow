"use client";

import Link from "next/link";

import { MatchScoreBar } from "@/components/find-jobs/MatchScoreBar";
import {
    formatRelativeFoundAt,
    type MockJobRow,
} from "@/lib/find-jobs-list";
import { cn } from "@/lib/utils";

const COLUMNS = [
  "Company",
  "Role",
  "Match Score",
  "Salary Est.",
  "Date Found",
] as const;

type JobsTableProps = {
  jobs: readonly MockJobRow[];
  className?: string;
};

export function JobsTable({ jobs, className }: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className={cn("px-6 py-16 text-center", className)}>
        <p className="text-sm text-text-muted">
          No jobs match your filters. Try adjusting search or match level.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-[11px] font-medium tracking-wide text-text-secondary uppercase sm:px-5"
              >
                {column}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
