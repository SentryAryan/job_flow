import { Sparkles } from "lucide-react";

type AiMatchReasoningProps = {
  matchReason: string | null;
};

export function AiMatchReasoning({ matchReason }: AiMatchReasoningProps) {
  const text =
    matchReason?.trim() ||
    "No AI match reasoning is available for this job yet.";

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles
          className="size-4 shrink-0 text-success-darker"
          aria-hidden
        />
        <h2 className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
          AI Match Reasoning
        </h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-dark">{text}</p>
    </section>
  );
}
