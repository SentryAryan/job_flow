import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard placeholder main skeleton (no Navbar). */
export function DashboardPageSkeleton() {
  return (
    <main
      className="flex flex-col items-center justify-center gap-4 px-6 py-16"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-2 h-9 w-28 rounded-md" />
    </main>
  );
}
