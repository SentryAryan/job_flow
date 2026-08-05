import type { CSSProperties } from "react";

/** Shared motion timing for profile / app UI. Prefer opacity over translate for a11y. */
export const motionTokens = {
  duration: {
    fast: 0.18,
    normal: 0.28,
    slow: 0.45,
  },
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
} as const;

/**
 * Stagger step for `.jp-reveal` cascades. Keep steps at 30–40ms and total delay
 * under ~300ms — longer and the page reads as slow rather than choreographed.
 */
export const REVEAL_STAGGER_MS = 40;

/** Delay for a `.jp-reveal` element (see the components layer in globals.css). */
export function revealDelay(ms: number): CSSProperties {
  return { "--jp-reveal-delay": `${ms}ms` } as CSSProperties;
}
