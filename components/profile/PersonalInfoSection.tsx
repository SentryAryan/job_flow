"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Profile } from "@/types";

type PersonalInfoSectionProps = {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
};

export function PersonalInfoSection({
  profile,
  onChange,
}: PersonalInfoSectionProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-text-primary">Personal Info</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={profile.full_name ?? ""}
            onChange={(e) => onChange({ full_name: e.target.value })}
            placeholder="Your full name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={profile.email ?? ""}
            disabled
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={profile.phone ?? ""}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={profile.location ?? ""}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="City, Country"
          />
        </div>
        <div>
          <Label htmlFor="linkedin_url">LinkedIn URL</Label>
          <Input
            id="linkedin_url"
            type="url"
            value={profile.linkedin_url ?? ""}
            onChange={(e) => onChange({ linkedin_url: e.target.value })}
            placeholder="https://linkedin.com/in/..."
          />
        </div>
        <div>
          <Label htmlFor="portfolio_url">Portfolio / GitHub</Label>
          <Input
            id="portfolio_url"
            type="url"
            value={profile.portfolio_url ?? ""}
            onChange={(e) => onChange({ portfolio_url: e.target.value })}
            placeholder="https://github.com/..."
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="work_authorization">Work Authorization</Label>
          <Select
            id="work_authorization"
            value={profile.work_authorization ?? "citizen"}
            onChange={(e) => onChange({ work_authorization: e.target.value })}
          >
            <option value="citizen">Citizen</option>
            <option value="permanent_resident">Permanent Resident</option>
            <option value="visa_required">Visa Required</option>
          </Select>
        </div>
      </div>
    </section>
  );
}
