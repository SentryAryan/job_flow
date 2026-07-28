"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import Navbar from "@/components/layout/Navbar";
import { CompletionBanner } from "@/components/profile/CompletionBanner";
import { MotionSection } from "@/components/profile/MotionSection";
import { OpenRouterKeysSection } from "@/components/profile/OpenRouterKeysSection";
import { ProfileForm } from "@/components/profile/ProfileForm";
import {
    ResumeAiUsageCard,
    type ResumeAiUsageCardHandle,
} from "@/components/profile/ResumeAiUsageCard";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { ProfilePageSkeleton } from "@/components/profile/skeletons/ProfilePageSkeleton";
import { Button } from "@/components/ui/button";
import { captureEvent } from "@/lib/analytics";
import { fetchProfile } from "@/lib/profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import { isProfileDirty } from "@/lib/profile-dirty";
import { mergeExtractedIntoProfile } from "@/lib/resume-extract";
import type { Profile } from "@/types";

function ProfilePageContent() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedBaseline, setSavedBaseline] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const loadedForUserRef = useRef<string | null>(null);
  const usageCardRef = useRef<ResumeAiUsageCardHandle>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let active = true;
    const userId = user.id;
    const isInitial = loadedForUserRef.current !== userId;

    if (isInitial) {
      setLoading(true);
    }
    setLoadError(null);

    void fetchProfile(userId)
      .then((result) => {
        if (!active) return;

        if (result.success) {
          loadedForUserRef.current = userId;
          setProfile(result.data);
          setSavedBaseline(result.data);
          setLoadError(null);
        } else {
          setLoadError(result.error);
          if (isInitial) {
            setProfile(null);
            setSavedBaseline(null);
          }
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id, reloadKey]);

  const completion = useMemo(
    () => (profile ? getProfileCompletion(profile) : null),
    [profile],
  );

  const isDirty = useMemo(
    () => (profile ? isProfileDirty(profile, savedBaseline) : false),
    [profile, savedBaseline],
  );

  function handleSaved(next: Profile, wasAlreadyComplete: boolean) {
    setProfile(next);
    setSavedBaseline(next);
    if (next.is_complete && !wasAlreadyComplete && user?.id) {
      captureEvent("profile_completed", { userId: user.id });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {loading && !profile ? <ProfilePageSkeleton /> : null}
      {!loading && loadError && !profile ? (
        <main className="mx-auto flex max-w-3xl flex-col items-start gap-3 px-6 py-8 sm:px-8">
          <p className="text-sm text-error" role="alert">
            {loadError}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </Button>
        </main>
      ) : null}
      {profile && completion ? (
        <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 sm:px-8">
          {loadError ? (
            <p className="text-sm text-error" role="alert">
              {loadError}
            </p>
          ) : null}
          <MotionSection delay={0}>
            <CompletionBanner
              percent={completion.percent}
              missing={completion.missing}
            />
          </MotionSection>
          <MotionSection delay={0.04}>
            <ResumeAiUsageCard ref={usageCardRef} />
          </MotionSection>
          <MotionSection delay={0.06}>
            <OpenRouterKeysSection
              onKeysChanged={() => {
                void usageCardRef.current?.refresh();
              }}
            />
          </MotionSection>
          <MotionSection delay={0.08}>
            <ResumeUpload
              userId={profile.id}
              resumePdfUrl={profile.resume_pdf_url}
              isDirty={isDirty}
              onUploaded={(next) => {
                setProfile(next);
                setSavedBaseline((baseline) =>
                  baseline
                    ? { ...baseline, resume_pdf_url: next.resume_pdf_url }
                    : next,
                );
              }}
              onExtracted={(extracted) => {
                setProfile((current) =>
                  current
                    ? mergeExtractedIntoProfile(current, extracted)
                    : current,
                );
              }}
              onGenerated={(resumePdfUrl) => {
                setProfile((current) =>
                  current
                    ? { ...current, resume_pdf_url: resumePdfUrl }
                    : current,
                );
                setSavedBaseline((baseline) =>
                  baseline
                    ? { ...baseline, resume_pdf_url: resumePdfUrl }
                    : baseline,
                );
              }}
              onAiActionSettled={() => {
                void usageCardRef.current?.refresh();
              }}
            />
          </MotionSection>
          <MotionSection delay={0.12}>
            <ProfileForm
              profile={profile}
              onProfileChange={setProfile}
              onSaved={handleSaved}
            />
          </MotionSection>
        </main>
      ) : null}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard fallback={<ProfilePageSkeleton />}>
      <ProfilePageContent />
    </AuthGuard>
  );
}
