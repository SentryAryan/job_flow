"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Education, Profile } from "@/types";

type EducationSectionProps = {
  education: Profile["education"];
  onChange: (education: Partial<Education>) => void;
};

export function EducationSection({
  education,
  onChange,
}: EducationSectionProps) {
  return (
    <section>
      <h3 className="text-base font-semibold text-text-primary">Education</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="degree">Highest Degree</Label>
          <Select
            id="degree"
            value={education.degree ?? ""}
            onChange={(e) => onChange({ ...education, degree: e.target.value })}
          >
            <option value="">Select degree</option>
            <option value="High School">High School</option>
            <option value="Associate">Associate</option>
            <option value="Bachelor">Bachelor</option>
            <option value="Master">Master</option>
            <option value="PhD">PhD</option>
            <option value="Bootcamp">Bootcamp</option>
            <option value="Other">Other</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="field_of_study">Field of Study</Label>
          <Input
            id="field_of_study"
            value={education.field_of_study ?? ""}
            onChange={(e) =>
              onChange({ ...education, field_of_study: e.target.value })
            }
            placeholder="e.g. Computer Science"
          />
        </div>
        <div>
          <Label htmlFor="institution">Institution Name</Label>
          <Input
            id="institution"
            value={education.institution ?? ""}
            onChange={(e) =>
              onChange({ ...education, institution: e.target.value })
            }
            placeholder="E.g. State University"
          />
        </div>
        <div>
          <Label htmlFor="graduation_year">Graduation Year</Label>
          <Input
            id="graduation_year"
            value={education.graduation_year ?? ""}
            onChange={(e) =>
              onChange({ ...education, graduation_year: e.target.value })
            }
            placeholder="YYYY"
          />
        </div>
      </div>
    </section>
  );
}
