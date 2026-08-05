import { Check, X } from "lucide-react";

type SkillsComparisonProps = {
  matchedSkills: string[];
  missingSkills: string[];
};

export function SkillsComparison({
  matchedSkills,
  missingSkills,
}: SkillsComparisonProps) {
  const hasMatched = matchedSkills.length > 0;
  const hasMissing = missingSkills.length > 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
        Required Skills vs Your Profile
      </h2>

      {!hasMatched && !hasMissing ? (
        <p className="mt-3 text-sm text-text-secondary">
          No skill comparison is available for this job yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {hasMatched ? (
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">
                You have
              </p>
              <ul className="flex flex-wrap gap-2">
                {matchedSkills.map((skill) => (
                  <li
                    key={skill}
                    className="inline-flex items-center gap-1.5 rounded-full bg-success-lightest px-3 py-1 text-xs font-medium text-success-dark"
                  >
                    <Check className="size-3.5 shrink-0" aria-hidden />
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasMissing ? (
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">
                Gap skills
              </p>
              <ul className="flex flex-wrap gap-2">
                {missingSkills.map((skill) => (
                  <li
                    key={skill}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent"
                  >
                    <X className="size-3.5 shrink-0" aria-hidden />
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
