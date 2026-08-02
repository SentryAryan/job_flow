"use client";

import { Loader2, Search } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Rotating status under the Find Jobs form (matches real discovery steps). */
export const SEARCH_STATUS_MESSAGES = [
  "Searching Adzuna for matching roles…",
  "Scoring jobs against your profile…",
  "Saving discovered jobs…",
] as const;

const SKELETON_COLUMNS = [
  "Company",
  "Role",
  "Match Score",
  "Salary Est.",
  "Date Found",
] as const;

type JobsTableSkeletonProps = {
  rows?: number;
  className?: string;
};

/** Placeholder table that mirrors `JobsTable` column structure. */
export function JobsTableSkeleton({
  rows = 6,
  className,
}: JobsTableSkeletonProps) {
  return (
    <div
      className={cn("overflow-x-auto", className)}
      aria-busy
      aria-label="Loading jobs"
    >
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {SKELETON_COLUMNS.map((column) => (
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
          {Array.from({ length: rows }, (_, index) => (
            <tr
              key={index}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-md" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </td>
              <td className="px-4 py-3.5 sm:px-5">
                <Skeleton className="h-4 w-36" />
              </td>
              <td className="px-4 py-3.5 sm:px-5">
                <div className="flex min-w-[7.5rem] items-center gap-2.5">
                  <Skeleton className="h-4 w-9 shrink-0" />
                  <Skeleton className="h-1 w-full max-w-[5.5rem] rounded-full" />
                </div>
              </td>
              <td className="px-4 py-3.5 sm:px-5">
                <Skeleton className="h-4 w-24" />
              </td>
              <td className="px-4 py-3.5 sm:px-5">
                <Skeleton className="h-4 w-20" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SearchProgressBannerProps = {
  message: string;
  className?: string;
};

/** Inline progress banner under the Find Jobs form. */
export function SearchProgressBanner({
  message,
  className,
}: SearchProgressBannerProps) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-2.5 rounded-lg border border-accent/25 bg-accent-light px-3.5 py-2.5 text-sm font-medium text-accent",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Search className="size-4 shrink-0 animate-pulse" aria-hidden />
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
