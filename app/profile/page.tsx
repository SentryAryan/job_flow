"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import AppNavbar from "@/components/layout/AppNavbar";
import { CompletionBanner } from "@/components/profile/CompletionBanner";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { Button } from "@/components/ui/button";
import { captureEvent } from "@/lib/analytics";
import { fetchProfile } from "@/lib/profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import type { Profile } from "@/types";

function ProfileLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden="true"
      />
      <span className="sr-only">Loading profile</span>
    </div>
  );
}

function ProfilePageContent() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const loadedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    const userId = user.id;
    const isInitial = loadedForUserRef.current !== userId;

    if (isInitial) {
      setLoading(true);
    }
    setLoadError(null);

    void fetchProfile(userId).then((result) => {
      if (!active) return;

      if (result.success) {
        loadedForUserRef.current = userId;
        setProfile(result.data);
        setLoadError(null);
      } else {
        setLoadError(result.error);
        if (isInitial) {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user?.id, reloadKey]);

  const completion = useMemo(
    () => (profile ? getProfileCompletion(profile) : null),
    [profile],
  );

  function handleSaved(next: Profile, wasAlreadyComplete: boolean) {
    setProfile(next);
    if (next.is_complete && !wasAlreadyComplete && user?.id) {
      captureEvent("profile_completed", { userId: user.id });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 sm:px-8">
        {loading && !profile ? <ProfileLoading /> : null}
        {!loading && loadError && !profile ? (
          <div className="flex flex-col items-start gap-3">
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
          </div>
        ) : null}
        {profile && completion ? (
          <>
            {loadError ? (
              <p className="text-sm text-error" role="alert">
                {loadError}
              </p>
            ) : null}
            <CompletionBanner
              percent={completion.percent}
              missing={completion.missing}
            />
            <ResumeUpload
              userId={profile.id}
              resumePdfUrl={profile.resume_pdf_url}
              onUploaded={setProfile}
            />
            <ProfileForm
              profile={profile}
              onProfileChange={setProfile}
              onSaved={handleSaved}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfilePageContent />
    </AuthGuard>
  );
}
