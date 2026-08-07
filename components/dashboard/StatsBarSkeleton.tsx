import { Skeleton } from "@/components/ui/skeleton";
import { REVEAL_STAGGER_MS, revealDelay } from "@/lib/motion-tokens";

/** In-place loading stand-in for StatsBar (Feature 15). */
export function StatsBarSkeleton({
  revealDelayMs = 0,
}: {
  revealDelayMs?: number;
}) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading dashboard statistics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="jp-reveal flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          style={revealDelay(revealDelayMs + i * REVEAL_STAGGER_MS)}
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </section>
  );
}
