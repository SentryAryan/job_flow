"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Spinner } from "@/components/ui/spinner";
import { motionTokens } from "@/lib/motion-tokens";

type InlineActionStatusProps = {
  show: boolean;
  message: string;
  detail?: string;
};

/** Subtle status strip for long-running profile actions (extract / generate / upload). */
export function InlineActionStatus({
  show,
  message,
  detail,
}: InlineActionStatusProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{
            duration: reduceMotion ? 0 : motionTokens.duration.fast,
            ease: motionTokens.ease,
          }}
          className="overflow-hidden"
        >
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
            <Spinner size="sm" className="mt-0.5" label={message} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{message}</p>
              {detail ? (
                <p className="mt-0.5 text-xs text-text-muted">{detail}</p>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
