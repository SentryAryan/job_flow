"use client";

import { useMemo, useState } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import AppNavbar from "@/components/layout/AppNavbar";
import { CompletionBanner } from "@/components/profile/CompletionBanner";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { MOCK_PROFILE } from "@/lib/mock-profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import type { Profile } from "@/types";

function ProfilePageContent() {
  const [profile, setProfile] = useState<Profile>(MOCK_PROFILE);
  const completion = useMemo(() => getProfileCompletion(profile), [profile]);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 sm:px-8">
        <CompletionBanner
          percent={completion.percent}
          missing={completion.missing}
        />
        <ResumeUpload />
        <ProfileForm profile={profile} onProfileChange={setProfile} />
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
