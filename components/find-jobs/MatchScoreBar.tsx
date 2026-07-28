import { getMatchScoreBarClass } from "@/lib/find-jobs-list";
import { cn } from "@/lib/utils";

type MatchScoreBarProps = {
  score: number;
  className?: string;
};

export function MatchScoreBar({ score, className }: MatchScoreBarProps) {
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <div className={cn("flex min-w-[7.5rem] items-center gap-2.5", className)}>
      <span className="w-9 shrink-0 text-sm font-medium tabular-nums text-text-primary">
        {clamped}%
      </span>
      <div
        className="h-1 w-full max-w-[5.5rem] overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Match score ${clamped} percent`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            getMatchScoreBarClass(clamped),
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
