"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { fadeInUp, motionTokens } from "@/lib/motion-tokens";

type MotionSectionProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Soft entrance for profile page sections (respects reduced motion). */
export function MotionSection({
  children,
  className = "",
  delay = 0,
}: MotionSectionProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={{
        duration: motionTokens.duration.normal,
        ease: motionTokens.ease,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
