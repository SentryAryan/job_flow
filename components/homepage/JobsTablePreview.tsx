type JobRow = {
  company: string;
  initial: string;
  swatch: string;
  score: number;
  salary: string;
  source: string;
};

const JOBS: JobRow[] = [
  { company: "Stripe", initial: "S", swatch: "bg-accent", score: 94, salary: "$180k–$220k", source: "LinkedIn" },
  { company: "Linear", initial: "L", swatch: "bg-info-medium", score: 88, salary: "$160k–$200k", source: "LinkedIn" },
  { company: "Notion", initial: "N", swatch: "bg-overlay-dark", score: 76, salary: "$150k–$190k", source: "LinkedIn" },
  { company: "Vercel", initial: "V", swatch: "bg-text-black", score: 71, salary: "$170k–$210k", source: "LinkedIn" },
  { company: "Figma", initial: "F", swatch: "bg-warning", score: 63, salary: "$150k–$185k", source: "N/A" },
];

function scoreColor(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-info";
  return "bg-warning";
}

export default function JobsTablePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="grid grid-cols-[1.4fr_1.4fr_1.2fr_0.8fr] gap-3 border-b border-border px-4 py-3">
        {["Company", "Match Score", "Salary Est.", "Source"].map((header) => (
          <span
            key={header}
            className="text-[11px] font-medium uppercase tracking-wide text-text-secondary"
          >
            {header}
          </span>
        ))}
      </div>

      {JOBS.map((job) => (
        <div
          key={job.company}
          className="grid grid-cols-[1.4fr_1.4fr_1.2fr_0.8fr] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold text-white ${job.swatch}`}
            >
              {job.initial}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {job.company}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full ${scoreColor(job.score)}`}
                style={{ width: `${job.score}%` }}
              />
            </div>
            <span className="text-sm font-medium text-text-primary">
              {job.score}%
            </span>
          </div>

          <span className="text-sm text-text-dark">{job.salary}</span>

          <span
            className={`text-sm font-medium ${
              job.source === "N/A" ? "text-text-muted" : "text-info-dark"
            }`}
          >
            {job.source}
          </span>
        </div>
      ))}
    </div>
  );
}
