"use client";

import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
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
import type { DaySeriesPoint, MatchBucketPoint } from "@/lib/mock-dashboard";
import { revealDelay } from "@/lib/motion-tokens";

/**
 * Recharts defaults to 1500ms, which reads as sluggish. A data reveal can run
 * longer than a UI transition, but it still has to land quickly.
 */
const SERIES_DURATION_MS = 600;

/** Series draw-in, timed to start as its card finishes landing. */
function useSeriesAnimation(beginMs: number) {
  const reduceMotion = useReducedMotion();

  return {
    isAnimationActive: !reduceMotion,
    animationBegin: beginMs,
    animationDuration: SERIES_DURATION_MS,
    animationEasing: "ease-out",
  } as const;
}

const researchConfig = {
  count: {
    label: "Companies researched",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const jobsConfig = {
  count: {
    label: "Jobs found",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const matchConfig = {
  count: {
    label: "Jobs",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const axisTick = { fill: "var(--color-text-muted)", fontSize: 12 };

function ChartCard({
  title,
  children,
  delayMs,
}: {
  title: string;
  children: ReactNode;
  delayMs: number;
}) {
  return (
    <Card
      className="jp-reveal h-full bg-surface shadow-none"
      style={revealDelay(delayMs)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-text-primary">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CompanyResearchChart({
  data,
  revealDelayMs = 0,
}: {
  data: DaySeriesPoint[];
  revealDelayMs?: number;
}) {
  const series = useSeriesAnimation(revealDelayMs + 120);

  return (
    <ChartCard title="Company Research Activity" delayMs={revealDelayMs}>
      <ChartContainer
        config={researchConfig}
        className="aspect-auto h-[220px] w-full"
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
        >
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
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={axisTick}
            domain={[0, 12]}
            ticks={[0, 3, 6, 9, 12]}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            {...series}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function JobsFoundOverTimeChart({
  data,
  revealDelayMs = 0,
}: {
  data: DaySeriesPoint[];
  revealDelayMs?: number;
}) {
  const series = useSeriesAnimation(revealDelayMs + 120);

  return (
    <ChartCard title="Jobs Found Over Time" delayMs={revealDelayMs}>
      <ChartContainer
        config={jobsConfig}
        className="aspect-auto h-[220px] w-full"
      >
        <AreaChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="jobsFoundFill" x1="0" y1="0" x2="0" y2="1">
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
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={axisTick}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--color-count)"
            strokeWidth={3}
            fill="url(#jobsFoundFill)"
            {...series}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function MatchScoreDistributionChart({
  data,
  revealDelayMs = 0,
}: {
  data: MatchBucketPoint[];
  revealDelayMs?: number;
}) {
  const series = useSeriesAnimation(revealDelayMs + 120);

  return (
    <ChartCard title="Match Score Distribution" delayMs={revealDelayMs}>
      <ChartContainer
        config={matchConfig}
        className="aspect-auto h-[220px] w-full"
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="range"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={axisTick}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={axisTick}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            {...series}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
