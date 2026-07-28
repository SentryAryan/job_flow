import { Skeleton } from "@/components/ui/skeleton";

const TABLE_ROWS = 6;

/**
 * Find Jobs main column skeleton (no Navbar).
 * Mirrors SearchControls + filters + table + pagination.
 */
export function FindJobsPageSkeleton() {
  return (
    <main
      className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8"
      aria-busy="true"
      aria-label="Loading find jobs"
    >
      <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-full rounded-md lg:w-36" />
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-md" />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full max-w-xs rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-3">
          <div className="flex gap-6">
            {["Company", "Role", "Match", "Salary", "Date"].map((col) => (
              <Skeleton key={col} className="h-3 w-16" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: TABLE_ROWS }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-6 px-4 py-4"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-24 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      </section>
    </main>
  );
}
