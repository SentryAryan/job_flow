const STATS = [
  { value: "284", label: "Total Jobs Found", trend: "+12%" },
  { value: "82%", label: "Avg. Match Rate", trend: "+5%" },
  { value: "35", label: "Companies Researched", trend: "+8%" },
  { value: "28", label: "Jobs This Week", trend: "+3%" },
];

const ACTIVITY = [
  { dot: "bg-success", text: "New match — Senior Frontend Engineer", time: "2m ago" },
  { dot: "bg-accent", text: "Company research completed — Stripe", time: "18m ago" },
  { dot: "bg-info", text: "Resume tailored for Product Engineer", time: "1h ago" },
  { dot: "bg-warning", text: "New match — Full-Stack Developer", time: "3h ago" },
];

const CHART_BARS = [40, 55, 35, 70, 50, 85, 60, 95, 72, 48];

export default function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_28px_70px_-24px_rgba(43,127,255,0.4)]">
      {/* Browser chrome */}
      <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-secondary px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-error" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning" />
        <span className="h-2.5 w-2.5 rounded-full bg-success" />
        <div className="mx-auto rounded-full bg-surface px-4 py-1 text-[11px] text-text-muted">
          app.jobpilot.com/dashboard
        </div>
      </div>

      {/* App content */}
      <div className="bg-surface-secondary p-4 sm:p-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-medium text-text-secondary">
                  {stat.label}
                </span>
                <span className="rounded-sm bg-success-lightest px-1.5 py-0.5 text-[10px] font-medium text-success-darker">
                  {stat.trend}
                </span>
              </div>
              <div className="mt-2 text-[26px] font-semibold leading-none text-text-primary">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Activity + chart */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Recent Activity
            </h3>
            <ul className="mt-3 space-y-3">
              {ACTIVITY.map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                  <span className="flex-1 truncate text-xs font-medium text-text-dark">
                    {item.text}
                  </span>
                  <span className="shrink-0 text-[11px] text-text-muted">
                    {item.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Company Research Results
            </h3>
            <div className="mt-4 flex h-28 items-end gap-2">
              {CHART_BARS.map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-info-medium"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
