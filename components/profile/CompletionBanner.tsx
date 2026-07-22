import { Card } from "@/components/ui/card";
import type { MissingFieldTag } from "@/lib/profile-completion";

type CompletionBannerProps = {
  percent: number;
  missing: MissingFieldTag[];
};

function WarningIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="var(--color-error)" />
      <path
        d="M12 8v5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="1" fill="white" />
    </svg>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 72;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`Profile ${percent}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-error)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-base font-semibold text-text-primary">
        {percent}%
      </span>
    </div>
  );
}

export function CompletionBanner({ percent, missing }: CompletionBannerProps) {
  if (missing.length === 0) {
    return null;
  }

  return (
    <Card
      role="status"
      aria-live="polite"
      className="flex flex-col gap-4 border-error/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="mt-0.5 shrink-0">
          <WarningIcon />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">
            Profile needs attention
          </h2>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            Complete the missing fields to improve your chance of getting
            tailored matches and generating quality resumes.
          </p>
          {missing.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {missing.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-semibold uppercase tracking-wide text-error"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <ProgressRing percent={percent} />
    </Card>
  );
}
