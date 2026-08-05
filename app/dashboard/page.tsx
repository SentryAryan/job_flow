"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import {
    CompanyResearchChart,
    JobsFoundOverTimeChart,
    MatchScoreDistributionChart,
} from "@/components/dashboard/AnalyticsCharts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import Navbar from "@/components/layout/Navbar";
import { CompletionBanner } from "@/components/profile/CompletionBanner";
import { captureEvent } from "@/lib/analytics";
import {
    MOCK_DASHBOARD_ACTIVITY,
    MOCK_DASHBOARD_STATS,
    MOCK_JOBS_OVER_TIME,
    MOCK_MATCH_DISTRIBUTION,
    MOCK_RESEARCH_ACTIVITY,
} from "@/lib/mock-dashboard";
import { fetchProfile } from "@/lib/profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import type { Profile } from "@/types";

function DashboardContent() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);

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

        <StatsBar stats={MOCK_DASHBOARD_STATS} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <RecentActivity
              items={MOCK_DASHBOARD_ACTIVITY}
              revealDelayMs={100}
            />
          </div>
          <div className="lg:col-span-3">
            <CompanyResearchChart
              data={MOCK_RESEARCH_ACTIVITY}
              revealDelayMs={140}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <JobsFoundOverTimeChart
            data={MOCK_JOBS_OVER_TIME}
            revealDelayMs={180}
          />
          <MatchScoreDistributionChart
            data={MOCK_MATCH_DISTRIBUTION}
            revealDelayMs={220}
          />
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
