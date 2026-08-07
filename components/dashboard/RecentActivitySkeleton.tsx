import { Skeleton } from "@/components/ui/skeleton";
import { revealDelay } from "@/lib/motion-tokens";

/** In-place loading stand-in for RecentActivity (Feature 16). */
export function RecentActivitySkeleton({
  revealDelayMs = 0,
}: {
  revealDelayMs?: number;
}) {
  return (
    <div
      className="jp-reveal flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-6"
      style={revealDelay(revealDelayMs)}
      aria-busy="true"
      aria-label="Loading recent activity"
    >
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
  );
}
