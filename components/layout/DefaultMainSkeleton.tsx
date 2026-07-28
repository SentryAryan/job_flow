import { Skeleton } from "@/components/ui/skeleton";

/** Minimal main-area placeholder when AuthGuard has no page-specific fallback. */
export function DefaultMainSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8 sm:px-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </main>
  );
}
