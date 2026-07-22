"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Profile } from "@/types";

type JobPreferencesSectionProps = {
  profile: Profile;
  jobTitlesSeekingText: string;
  preferredLocationsText: string;
  onProfileChange: (patch: Partial<Profile>) => void;
  onJobTitlesSeekingTextChange: (value: string) => void;
  onPreferredLocationsTextChange: (value: string) => void;
};

export function JobPreferencesSection({
  profile,
  jobTitlesSeekingText,
  preferredLocationsText,
  onProfileChange,
  onJobTitlesSeekingTextChange,
  onPreferredLocationsTextChange,
}: JobPreferencesSectionProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-text-primary">
        Job Preferences
      </h3>
      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="job_titles_seeking">Job Titles Seeking</Label>
          <Input
            id="job_titles_seeking"
            value={jobTitlesSeekingText}
            onChange={(e) => onJobTitlesSeekingTextChange(e.target.value)}
            placeholder="Frontend engineer, React Developer"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="remote_preference">Remote Preference</Label>
            <Select
              id="remote_preference"
              value={profile.remote_preference ?? "any"}
              onChange={(e) =>
                onProfileChange({ remote_preference: e.target.value })
              }
            >
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="salary_expectation">
              Salary Expectation (Optional)
            </Label>
            <Input
              id="salary_expectation"
              value={profile.salary_expectation ?? ""}
              onChange={(e) =>
                onProfileChange({
                  salary_expectation: e.target.value || null,
                })
              }
              placeholder="e.g. $80,000"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="preferred_locations">
            Preferred Locations (Optional)
          </Label>
          <Input
            id="preferred_locations"
            value={preferredLocationsText}
            onChange={(e) => onPreferredLocationsTextChange(e.target.value)}
            placeholder="e.g. New York, London"
          />
        </div>
      </div>
    </section>
  );
}
