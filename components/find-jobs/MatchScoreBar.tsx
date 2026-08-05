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
        {/*
          scaleX rather than width: a full page of rows re-scoring at once would
          otherwise trigger layout on every frame. Transform stays on the GPU.
        */}
        <div
          className={cn(
            "h-full w-full origin-left rounded-full transition-transform duration-500 ease-out-strong",
            getMatchScoreBarClass(clamped),
          )}
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </div>
    </div>
  );
}
