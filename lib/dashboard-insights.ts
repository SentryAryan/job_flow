/**
 * Dashboard Product Insights (PostHog engagement — not job inventory).
 */

import { authedFetch } from "@/lib/authed-fetch";
import type { DaySeriesPoint } from "@/lib/dashboard-charts";
import type { DashboardChartRange } from "@/lib/dashboard-range";

export type FeatureUsagePoint = {
  feature: string;
  count: number;
};

export type DashboardInsightsData = {
  jobSearchesOverTime: DaySeriesPoint[];
  featureUsage: FeatureUsagePoint[];
};

export const FEATURE_USAGE_KEYS = [
  "resume_generated",
  "company_researched",
  "profile_completed",
] as const;

export type FeatureUsageKey = (typeof FEATURE_USAGE_KEYS)[number];

export const FEATURE_USAGE_LABELS: Record<FeatureUsageKey, string> = {
  resume_generated: "Resume generated",
  company_researched: "Company researched",
  profile_completed: "Profile completed",
};

export function emptyFeatureUsage(): FeatureUsagePoint[] {
  return FEATURE_USAGE_KEYS.map((key) => ({
    feature: FEATURE_USAGE_LABELS[key],
    count: 0,
  }));
}

export function emptyDashboardInsights(
  jobSearchesOverTime: DaySeriesPoint[] = [],
): DashboardInsightsData {
  return {
    jobSearchesOverTime,
    featureUsage: emptyFeatureUsage(),
  };
}

export function mapFeatureUsageCounts(
  counts: Partial<Record<FeatureUsageKey, number>>,
): FeatureUsagePoint[] {
  return FEATURE_USAGE_KEYS.map((key) => ({
    feature: FEATURE_USAGE_LABELS[key],
    count: counts[key] ?? 0,
  }));
}

export type FetchInsightsResult =
  | { success: true; data: DashboardInsightsData }
  | { success: false; error: string };

export async function fetchDashboardInsights(
  range: DashboardChartRange,
): Promise<FetchInsightsResult> {
  try {
    const qs = new URLSearchParams({ range });
    const response = await authedFetch(
      `/api/dashboard/insights?${qs.toString()}`,
      { method: "GET", cache: "no-store" },
    );

    const payload = (await response.json()) as {
      success?: boolean;
      data?: DashboardInsightsData;
      error?: string | null;
    };

    if (!response.ok || !payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "Could not load insights. Please try again.",
      };
    }

    return { success: true, data: payload.data };
  } catch {
    return {
      success: false,
      error: "Could not load insights. Please try again.",
    };
  }
}
