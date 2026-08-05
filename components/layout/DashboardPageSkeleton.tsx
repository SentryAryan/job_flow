import { Skeleton } from "@/components/ui/skeleton";

/** AuthGuard fallback — mirrors dashboard layout (no Navbar). */
export function DashboardPageSkeleton() {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 lg:col-span-2">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="mt-1 size-4 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-full max-w-[220px]" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 lg:col-span-3">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
          >
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-[220px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </main>
  );
}
