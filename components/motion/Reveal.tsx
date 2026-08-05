import type { ReactNode } from "react";

import { REVEAL_STAGGER_MS, revealDelay } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  /** Explicit delay in ms. Prefer `step` for evenly spaced cascades. */
  delayMs?: number;
  /** Position in a cascade; multiplied by `REVEAL_STAGGER_MS`. */
  step?: number;
  className?: string;
};

/**
 * Entrance wrapper for the shared `.jp-reveal` CSS animation (see globals.css).
 * Only wrap elements that mount once per visit — replaying this on every filter
 * or pagination change would make routine interactions feel slow.
 */
export function Reveal({ children, delayMs, step = 0, className }: RevealProps) {
  return (
    <div
      className={cn("jp-reveal", className)}
      style={revealDelay(delayMs ?? step * REVEAL_STAGGER_MS)}
    >
      {children}
    </div>
  );
}
