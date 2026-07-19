import AgentTerminal from "@/components/homepage/AgentTerminal";

const POINTS = [
  {
    title: "Understand Your Match Score",
    description:
      "See how each job aligns with your skills and experience, with a clear reason behind every score.",
    accent: "border-l-transparent",
  },
  {
    title: "AI-Powered Job Matching",
    description:
      "GPT-4o scores every job against your actual profile, so you spend time on the roles that genuinely fit.",
    accent: "border-l-success",
  },
  {
    title: "Focus on the Right Roles",
    description:
      "Filter by match and skip the noise. Spend your energy researching and applying, not endlessly scrolling.",
    accent: "border-l-transparent",
  },
];

export default function Confidence() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center bg-surface-muted px-6 py-12 lg:px-10 lg:py-16">
        <AgentTerminal />
      </div>

      <div className="border-t border-t-border bg-surface px-6 py-12 lg:border-t-0 lg:border-l lg:border-l-border lg:px-10 lg:py-16">
        <h2 className="max-w-sm text-3xl font-bold leading-tight text-text-darkest">
          Apply With More Confidence, Every Time
        </h2>

        <div className="mt-8">
          {POINTS.map((point) => (
            <div
              key={point.title}
              className={`border-t border-t-border border-l-2 ${point.accent} py-5 pl-5`}
            >
              <h3 className="text-base font-semibold text-text-primary">
                {point.title}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
