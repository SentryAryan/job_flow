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
    emptyDashboardCharts,
    fetchDashboardCharts,
    type DashboardChartsData,
} from "@/lib/dashboard-charts";
import { fetchProfile } from "@/lib/profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import type { Profile } from "@/types";

function DashboardContent() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_DASHBOARD_STATS);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [charts, setCharts] = useState<DashboardChartsData>(() =>
    emptyDashboardCharts(),
  );
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

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
    setChartsLoading(true);

    void fetchDashboardCharts().then((result) => {
      if (!active) return;
      setChartsLoading(false);
      if (result.success) {
        setCharts(result.data);
        return;
      }
      setCharts(emptyDashboardCharts());
      toast.error(result.error);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

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
          /* Arrives after the profile fetch — reveal so it doesn't just pop in. */
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {dashboardLoading ? (
              <RecentActivitySkeleton revealDelayMs={100} />
            ) : (
              <RecentActivity items={activity} revealDelayMs={100} />
            )}
          </div>
          <div className="lg:col-span-3">
            {chartsLoading ? (
              <ChartCardSkeleton
                revealDelayMs={140}
                titleWidthClass="w-52"
              />
            ) : (
              <CompanyResearchChart
                data={charts.researchActivity}
                revealDelayMs={140}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {chartsLoading ? (
            <>
              <ChartCardSkeleton revealDelayMs={180} />
              <ChartCardSkeleton revealDelayMs={220} />
            </>
          ) : (
            <>
              <JobsFoundOverTimeChart
                data={charts.jobsOverTime}
                revealDelayMs={180}
              />
              <MatchScoreDistributionChart
                data={charts.matchDistribution}
                revealDelayMs={220}
              />
            </>
          )}
        </div>
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
