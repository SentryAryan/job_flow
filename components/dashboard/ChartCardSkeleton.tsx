import { Skeleton } from "@/components/ui/skeleton";
import { revealDelay } from "@/lib/motion-tokens";

/** In-place loading stand-in for a dashboard chart card (Feature 17). */
export function ChartCardSkeleton({
  revealDelayMs = 0,
  titleWidthClass = "w-44",
}: {
  revealDelayMs?: number;
  titleWidthClass?: string;
}) {
  return (
    <div
      className="jp-reveal flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-6"
      style={revealDelay(revealDelayMs)}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <Skeleton className={`h-5 ${titleWidthClass}`} />
      <Skeleton className="h-[220px] w-full rounded-lg" />
    </div>
  );
}
