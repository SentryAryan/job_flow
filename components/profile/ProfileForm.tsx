"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EducationSection } from "@/components/profile/EducationSection";
import { JobPreferencesSection } from "@/components/profile/JobPreferencesSection";
import { PersonalInfoSection } from "@/components/profile/PersonalInfoSection";
import { ProfessionalInfoSection } from "@/components/profile/ProfessionalInfoSection";
import { WorkExperienceSection } from "@/components/profile/WorkExperienceSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    profileToSaveInput,
    saveProfile,
    type ProfileSaveInput,
} from "@/lib/profile";
import type { Profile } from "@/types";

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

type ProfileFormProps = {
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
  onSaved: (profile: Profile, wasAlreadyComplete: boolean) => void;
};

export function ProfileForm({
  profile,
  onProfileChange,
  onSaved,
}: ProfileFormProps) {
  const [jobTitlesSeekingText, setJobTitlesSeekingText] = useState(() =>
    profile.job_titles_seeking.join(", "),
  );
  const [preferredLocationsText, setPreferredLocationsText] = useState(() =>
    profile.preferred_locations.join(", "),
  );
  const [pending, setPending] = useState(false);

  function patch(partial: Partial<Profile>) {
    onProfileChange({ ...profile, ...partial });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);

    const nextProfile: Profile = {
      ...profile,
      job_titles_seeking: splitCommaList(jobTitlesSeekingText),
      preferred_locations: splitCommaList(preferredLocationsText),
    };
    onProfileChange(nextProfile);

    const input: ProfileSaveInput = profileToSaveInput(nextProfile);
    const wasAlreadyComplete = profile.is_complete;
    const result = await saveProfile(profile.id, input, {
      email: nextProfile.email,
      resume_pdf_url: nextProfile.resume_pdf_url,
      cover_letter_tone: nextProfile.cover_letter_tone,
    });

    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    onSaved(result.data, wasAlreadyComplete);
    toast.success("Profile saved");
  }

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-text-primary">
          Profile Information
        </h2>
        <p className="mt-1 text-sm font-medium text-text-secondary">
          This content is used to accurately represent you in agent
          interactions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <PersonalInfoSection profile={profile} onChange={patch} />
        <div className="border-t border-border" />
        <ProfessionalInfoSection profile={profile} onChange={patch} />
        <div className="border-t border-border" />
        <WorkExperienceSection
          roles={profile.work_experience}
          onChange={(work_experience) => patch({ work_experience })}
        />
        <div className="border-t border-border" />
        <EducationSection
          education={profile.education}
          onChange={(education) => patch({ education })}
        />
        <div className="border-t border-border" />
        <JobPreferencesSection
          profile={profile}
          jobTitlesSeekingText={jobTitlesSeekingText}
          preferredLocationsText={preferredLocationsText}
          onProfileChange={patch}
          onJobTitlesSeekingTextChange={setJobTitlesSeekingText}
          onPreferredLocationsTextChange={setPreferredLocationsText}
        />

        <Button
          type="submit"
          className="w-full py-3 text-sm font-medium"
          disabled={pending}
        >
          {pending ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </Card>
  );
}
