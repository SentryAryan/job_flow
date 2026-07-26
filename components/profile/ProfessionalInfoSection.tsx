"use client";

import { TagInput } from "@/components/profile/TagInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Profile } from "@/types";

type ProfessionalInfoSectionProps = {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
};

export function ProfessionalInfoSection({
  profile,
  onChange,
}: ProfessionalInfoSectionProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-text-primary">
        Professional Info
      </h3>
      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="current_title">Current/Recent Job Title</Label>
          <Input
            id="current_title"
            value={profile.current_title ?? ""}
            onChange={(e) => onChange({ current_title: e.target.value })}
            placeholder="e.g. Frontend Engineer"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="experience_level">Experience Level</Label>
            <Select
              value={profile.experience_level ?? "junior"}
              onValueChange={(value) => onChange({ experience_level: value })}
            >
              <SelectTrigger id="experience_level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="years_experience">Years of Experience</Label>
            <Input
              id="years_experience"
              type="number"
              min={0}
              value={profile.years_experience ?? ""}
              onChange={(e) =>
                onChange({
                  years_experience:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="0"
            />
          </div>
        </div>
        <TagInput
          id="skills"
          label="Skills"
          tags={profile.skills}
          placeholder="e.g. React"
          onChange={(skills) => onChange({ skills })}
        />
        <TagInput
          id="industries"
          label="Industries Worked In"
          tags={profile.industries}
          placeholder="e.g. Fintech, Healthcare"
          optional
          onChange={(industries) => onChange({ industries })}
        />
      </div>
    </section>
  );
}
