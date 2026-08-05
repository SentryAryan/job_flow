import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    formatStatValue,
    formatTrendPercent,
    trendBadgeClasses,
    type DashboardStat,
    type DashboardStats,
} from "@/lib/mock-dashboard";
import { REVEAL_STAGGER_MS, revealDelay } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

type StatsBarProps = {
  stats: DashboardStats;
  /** Delay before the first card reveals; later cards stagger from here. */
  revealDelayMs?: number;
};

function StatCard({
  title,
  stat,
  delayMs,
}: {
  title: string;
  stat: DashboardStat;
  delayMs: number;
}) {
  return (
    <Card
      size="sm"
      className="jp-reveal bg-surface shadow-none"
      style={revealDelay(delayMs)}
    >
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        <p className="text-3xl font-bold tracking-tight text-text-primary">
          {formatStatValue(stat.value, stat.format ?? "number")}
        </p>
        {stat.trend ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              className={cn(
                "h-5 rounded-sm border-transparent px-1.5 text-xs font-semibold",
                trendBadgeClasses(stat.trend.percent),
              )}
            >
              {formatTrendPercent(stat.trend.percent)}
            </Badge>
            <span className="text-xs text-text-muted">{stat.trend.label}</span>
          </div>
        ) : null}
        {stat.subtext ? (
          <p className="text-xs text-text-muted">{stat.subtext}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatsBar({ stats, revealDelayMs = 0 }: StatsBarProps) {
  const cards = [
    { title: "Total Jobs Found", stat: stats.totalJobsFound },
    { title: "Avg. Match Rate", stat: stats.avgMatchRate },
    { title: "Companies Researched", stat: stats.companiesResearched },
    { title: "Jobs This Week", stat: stats.jobsThisWeek },
  ];

  return (
    <section
      aria-label="Dashboard statistics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map((card, index) => (
        <StatCard
          key={card.title}
          title={card.title}
          stat={card.stat}
          delayMs={revealDelayMs + index * REVEAL_STAGGER_MS}
        />
      ))}
    </section>
  );
}
