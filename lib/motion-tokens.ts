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
