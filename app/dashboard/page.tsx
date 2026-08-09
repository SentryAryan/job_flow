"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import {
    CompanyResearchChart,
    JobsFoundOverTimeChart,
    MatchScoreDistributionChart,
} from "@/components/dashboard/AnalyticsCharts";
import { ChartCardSkeleton } from "@/components/dashboard/ChartCardSkeleton";
import { ChartRangeSelect } from "@/components/dashboard/ChartRangeSelect";
import { ProductInsights } from "@/components/dashboard/ProductInsights";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RecentActivitySkeleton } from "@/components/dashboard/RecentActivitySkeleton";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { StatsBarSkeleton } from "@/components/dashboard/StatsBarSkeleton";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import Navbar from "@/components/layout/Navbar";
import { CompletionBanner } from "@/components/profile/CompletionBanner";
import { captureEvent } from "@/lib/analytics";
import {
    EMPTY_DASHBOARD_STATS,
    fetchDashboardSummary,
    type DashboardActivityItem,
    type DashboardStats,
} from "@/lib/dashboard";
import {
    emptyDaySeries,
    emptyMatchDistribution,
    fetchJobsOverTimeChart,
    fetchMatchDistributionChart,
    fetchResearchActivityChart,
    type DaySeriesPoint,
    type MatchBucketPoint,
} from "@/lib/dashboard-charts";
import {
    emptyDashboardInsights,
    fetchDashboardInsights,
    type DashboardInsightsData,
} from "@/lib/dashboard-insights";
import {
    DEFAULT_DASHBOARD_CHART_RANGE,
    type DashboardChartRange,
} from "@/lib/dashboard-range";
import { fetchProfile } from "@/lib/profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import type { Profile } from "@/types";

function DashboardContent() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_DASHBOARD_STATS);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [chartRange, setChartRange] = useState<DashboardChartRange>(
    DEFAULT_DASHBOARD_CHART_RANGE,
  );
  const [jobsOverTime, setJobsOverTime] = useState<DaySeriesPoint[]>(() =>
    emptyDaySeries(30),
  );
  const [matchDistribution, setMatchDistribution] = useState<
    MatchBucketPoint[]
  >(() => emptyMatchDistribution());
  const [researchActivity, setResearchActivity] = useState<DaySeriesPoint[]>(
    () => emptyDaySeries(30),
  );
  const [insights, setInsights] = useState<DashboardInsightsData>(() =>
    emptyDashboardInsights(emptyDaySeries(30)),
  );
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [jobsChartLoading, setJobsChartLoading] = useState(true);
  const [matchChartLoading, setMatchChartLoading] = useState(true);
  const [researchChartLoading, setResearchChartLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);

  useEffect(() => {
    captureEvent("dashboard_viewed");
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    void fetchProfile(user.id).then((result) => {
      if (!active) return;
      if (result.success) {
        setProfile(result.data);
      }
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    setDashboardLoading(true);

    void fetchDashboardSummary().then((result) => {
      if (!active) return;
      setDashboardLoading(false);
      if (result.success) {
        setStats(result.data.stats);
        setActivity(result.data.activity);
        return;
      }
      setStats(EMPTY_DASHBOARD_STATS);
      setActivity([]);
      toast.error(result.error);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    setJobsChartLoading(true);
    setMatchChartLoading(true);
    setResearchChartLoading(true);
    setInsightsLoading(true);

    void fetchJobsOverTimeChart(chartRange).then((result) => {
      if (!active) return;
      setJobsChartLoading(false);
      if (result.success) {
        setJobsOverTime(result.data);
        return;
      }
      setJobsOverTime(emptyDaySeries(30));
      toast.error(result.error);
    });

    void fetchMatchDistributionChart(chartRange).then((result) => {
      if (!active) return;
      setMatchChartLoading(false);
      if (result.success) {
        setMatchDistribution(result.data);
        return;
      }
      setMatchDistribution(emptyMatchDistribution());
      toast.error(result.error);
    });

    void fetchResearchActivityChart(chartRange).then((result) => {
      if (!active) return;
      setResearchChartLoading(false);
      if (result.success) {
        setResearchActivity(result.data);
        return;
      }
      setResearchActivity(emptyDaySeries(30));
      toast.error(result.error);
    });

    void fetchDashboardInsights(chartRange).then((result) => {
      if (!active) return;
      setInsightsLoading(false);
      if (result.success) {
        setInsights(result.data);
        return;
      }
      setInsights(emptyDashboardInsights(emptyDaySeries(30)));
      toast.error(result.error);
    });

    return () => {
      active = false;
    };
  }, [user?.id, chartRange]);

  const completion = useMemo(
    () => (profile ? getProfileCompletion(profile) : null),
    [profile],
  );

  const showIncompleteBanner =
    profile != null &&
    !profile.is_complete &&
    completion != null &&
    completion.missing.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-8">
        {showIncompleteBanner && completion ? (
          <div className="jp-reveal">
            <CompletionBanner
              percent={completion.percent}
              missing={completion.missing}
            />
          </div>
        ) : null}

        {dashboardLoading ? (
          <StatsBarSkeleton />
        ) : (
          <StatsBar stats={stats} />
        )}

        <ChartRangeSelect value={chartRange} onValueChange={setChartRange} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {dashboardLoading ? (
              <RecentActivitySkeleton revealDelayMs={100} />
            ) : (
              <RecentActivity items={activity} revealDelayMs={100} />
            )}
          </div>
          <div className="lg:col-span-3">
            {researchChartLoading ? (
              <ChartCardSkeleton
                revealDelayMs={140}
                titleWidthClass="w-52"
              />
            ) : (
              <CompanyResearchChart
                data={researchActivity}
                revealDelayMs={140}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {jobsChartLoading ? (
            <ChartCardSkeleton revealDelayMs={180} />
          ) : (
            <JobsFoundOverTimeChart
              data={jobsOverTime}
              revealDelayMs={180}
            />
          )}
          {matchChartLoading ? (
            <ChartCardSkeleton revealDelayMs={220} />
          ) : (
            <MatchScoreDistributionChart
              data={matchDistribution}
              revealDelayMs={220}
            />
          )}
        </div>

        {insightsLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCardSkeleton revealDelayMs={260} />
            <ChartCardSkeleton revealDelayMs={300} />
          </div>
        ) : (
          <ProductInsights
            jobSearchesOverTime={insights.jobSearchesOverTime}
            featureUsage={insights.featureUsage}
            revealDelayMs={260}
          />
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard fallback={<DashboardPageSkeleton />}>
      <DashboardContent />
    </AuthGuard>
  );
}
