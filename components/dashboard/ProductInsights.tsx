"use client";

import { useReducedMotion } from "motion/react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import {
    chartYDomainMax,
    isChartSeriesEmpty,
    type DaySeriesPoint,
} from "@/lib/dashboard-charts";
import type { FeatureUsagePoint } from "@/lib/dashboard-insights";
import { revealDelay } from "@/lib/motion-tokens";

const SERIES_DURATION_MS = 600;

function useSeriesAnimation(beginMs: number) {
  const reduceMotion = useReducedMotion();

  return {
    isAnimationActive: !reduceMotion,
    animationBegin: beginMs,
    animationDuration: SERIES_DURATION_MS,
    animationEasing: "ease-out",
  } as const;
}

const searchesConfig = {
  count: {
    label: "Job searches",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const featureConfig = {
  count: {
    label: "Events",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const axisTick = { fill: "var(--color-text-muted)", fontSize: 12 };

function ChartEmptyState({ message }: { message: string }) {
  return (
    <p className="flex h-[220px] items-center justify-center text-sm text-text-muted">
      {message}
    </p>
  );
}

export function ProductInsights({
  jobSearchesOverTime,
  featureUsage,
  revealDelayMs = 0,
}: {
  jobSearchesOverTime: DaySeriesPoint[];
  featureUsage: FeatureUsagePoint[];
  revealDelayMs?: number;
}) {
  const searchSeries = useSeriesAnimation(revealDelayMs + 120);
  const featureSeries = useSeriesAnimation(revealDelayMs + 160);
  const searchYMax = chartYDomainMax(jobSearchesOverTime);
  const featureYMax = chartYDomainMax(featureUsage);

  return (
    <section aria-label="Product insights" className="flex flex-col gap-4">
      <div className="jp-reveal" style={revealDelay(revealDelayMs)}>
        <h2 className="text-lg font-semibold text-text-primary">
          Product Insights
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Engagement from analytics events (searches and feature usage)—not the
          same as jobs saved in your account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          className="jp-reveal h-full bg-surface shadow-none"
          style={revealDelay(revealDelayMs + 40)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-text-primary">
              Job Searches Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isChartSeriesEmpty(jobSearchesOverTime) ? (
              <ChartEmptyState message="No searches tracked yet." />
            ) : (
              <ChartContainer
                config={searchesConfig}
                className="aspect-auto h-[220px] w-full"
              >
                <AreaChart
                  accessibilityLayer
                  data={jobSearchesOverTime}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="jobSearchesFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-count)"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-count)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={axisTick}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tick={axisTick}
                    domain={[0, searchYMax]}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={3}
                    fill="url(#jobSearchesFill)"
                    {...searchSeries}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card
          className="jp-reveal h-full bg-surface shadow-none"
          style={revealDelay(revealDelayMs + 80)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-text-primary">
              Feature Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isChartSeriesEmpty(featureUsage) ? (
              <ChartEmptyState message="No feature events yet." />
            ) : (
              <ChartContainer
                config={featureConfig}
                className="aspect-auto h-[220px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={featureUsage}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="feature"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={axisTick}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tick={axisTick}
                    domain={[0, featureYMax]}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                    {...featureSeries}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
