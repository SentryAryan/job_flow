import { BackToJobs } from "@/components/job-details/BackToJobs";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Job details main column skeleton (no Navbar).
 * Mirrors header + meta cards + content sections + apply CTA.
 */
export function JobDetailsSkeleton() {
  return (
    <main
      className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8"
      aria-busy="true"
      aria-label="Loading job details"
    >
      <BackToJobs />

      <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {Array.from({ length: 4 }, (_, i) => (
        <section
          key={i}
          className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-16 w-full" />
        </section>
      ))}

      <Skeleton className="h-12 w-full rounded-xl" />
    </main>
  );
}
