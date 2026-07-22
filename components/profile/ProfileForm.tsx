"use client";

import { useState, type FormEvent } from "react";

import { EducationSection } from "@/components/profile/EducationSection";
import { JobPreferencesSection } from "@/components/profile/JobPreferencesSection";
import { PersonalInfoSection } from "@/components/profile/PersonalInfoSection";
import { ProfessionalInfoSection } from "@/components/profile/ProfessionalInfoSection";
import { WorkExperienceSection } from "@/components/profile/WorkExperienceSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
};

export function ProfileForm({ profile, onProfileChange }: ProfileFormProps) {
  const [jobTitlesSeekingText, setJobTitlesSeekingText] = useState(() =>
    profile.job_titles_seeking.join(", "),
  );
  const [preferredLocationsText, setPreferredLocationsText] = useState(() =>
    profile.preferred_locations.join(", "),
  );

  function patch(partial: Partial<Profile>) {
    onProfileChange({ ...profile, ...partial });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onProfileChange({
      ...profile,
      job_titles_seeking: splitCommaList(jobTitlesSeekingText),
      preferred_locations: splitCommaList(preferredLocationsText),
    });
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

        <Button type="submit" className="w-full py-3 text-sm font-medium">
          Save Profile
        </Button>
      </form>
    </Card>
  );
}
