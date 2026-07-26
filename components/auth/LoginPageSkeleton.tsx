import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

/** Login page chrome + split card skeleton (includes Navbar). */
export function LoginPageSkeleton() {
  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      aria-busy="true"
      aria-label="Loading sign in"
    >
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-[760px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] md:grid-cols-2">
          <div className="flex flex-col justify-center gap-4 p-8 md:p-10">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="mt-2 h-10 w-full" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="mt-2 h-16 w-full max-w-sm" />
            <Skeleton className="mt-4 h-3 w-48" />
          </div>
          <div className="flex flex-col justify-center gap-3 border-t border-border p-8 md:border-l md:border-t-0 md:p-10">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-52" />
            <div className="mt-4 flex flex-col gap-3">
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
