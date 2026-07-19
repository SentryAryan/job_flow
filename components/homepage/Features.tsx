import JobsTablePreview from "@/components/homepage/JobsTablePreview";

const FEATURES = [
  {
    title: "Find Jobs That Actually Fit",
    description:
      "Search by title and location for tech roles. GPT-4o scores every result against your profile so you see the best matches first.",
    accent: "border-l-accent",
  },
  {
    title: "Know the Company Before You Apply",
    description:
      "Your agent researches each company and builds a dossier — culture, tech stack, and recent news — so you walk in prepared.",
    accent: "border-l-transparent",
  },
  {
    title: "Keep Track of Every Application",
    description:
      "Your whole search lives on one dashboard: match scores, research, and analytics, all in a single place.",
    accent: "border-l-transparent",
  },
];

export default function Features() {
  return (
    <section className="grid grid-cols-1 border-t border-border lg:grid-cols-2">
      <div className="px-6 py-12 lg:px-10 lg:py-16">
        <h2 className="max-w-sm text-3xl font-bold leading-tight text-text-darkest">
          Manage Your Job Search With Ease
        </h2>

        <div className="mt-8">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`border-t border-t-border border-l-2 ${feature.accent} py-5 pl-5`}
            >
              <h3 className="text-base font-semibold text-text-primary">
                {feature.title}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center border-t border-t-border bg-surface-muted px-6 py-12 lg:border-t-0 lg:border-l lg:border-l-border lg:px-10 lg:py-16">
        <JobsTablePreview />
      </div>
    </section>
  );
}
