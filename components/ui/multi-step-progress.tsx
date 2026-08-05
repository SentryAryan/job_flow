"use client";

import { Check, Circle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type MultiStepProgressProps = {
  steps: readonly string[];
  /** Zero-based index of the step currently in progress. */
  currentIndex: number;
  className?: string;
};

/**
 * Shows completed steps, the active step, and upcoming steps for long AI flows
 * (Company Research, Find Jobs).
 */
export function MultiStepProgress({
  steps,
  currentIndex,
  className,
}: MultiStepProgressProps) {
  if (steps.length === 0) return null;

  const active = Math.min(
    Math.max(0, currentIndex),
    steps.length - 1,
  );

  return (
    <ol
      className={cn(
        "mt-4 space-y-2 rounded-lg border border-accent/25 bg-accent-light px-3.5 py-3",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`Step ${active + 1} of ${steps.length}: ${steps[active]}`}
    >
      {steps.map((label, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <li
            key={`${index}:${label}`}
            className={cn(
              "flex items-start gap-2.5 text-sm",
              done && "text-text-secondary",
              current && "font-medium text-accent",
              !done && !current && "text-text-muted",
            )}
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-hidden>
              {done ? (
                <Check className="size-4 text-success" strokeWidth={2.5} />
              ) : current ? (
                <Loader2 className="size-4 animate-spin text-accent" />
              ) : (
                <Circle className="size-3.5 text-text-muted" strokeWidth={2} />
              )}
            </span>
            <span>
              {done ? (
                <span className="sr-only">Completed: </span>
              ) : current ? (
                <span className="sr-only">In progress: </span>
              ) : (
                <span className="sr-only">Upcoming: </span>
              )}
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
