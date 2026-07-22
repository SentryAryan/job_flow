"use client";

import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkExperienceRole } from "@/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 50 }, (_, i) => CURRENT_YEAR - i);

function parseYearMonth(value: string | null): { month: string; year: string } {
  if (!value) return { month: "", year: "" };
  const [year = "", month = ""] = value.split("-");
  return { month, year };
}

function toYearMonth(month: string, year: string): string {
  if (!month || !year) return "";
  return `${year}-${month.padStart(2, "0")}`;
}

const EMPTY_ROLE: WorkExperienceRole = {
  company: "",
  title: "",
  start_date: "",
  end_date: null,
  is_current: false,
  responsibilities: "",
};

type WorkExperienceSectionProps = {
  roles: WorkExperienceRole[];
  onChange: (roles: WorkExperienceRole[]) => void;
};

export function WorkExperienceSection({
  roles,
  onChange,
}: WorkExperienceSectionProps) {
  const clientIdsRef = useRef<string[]>([]);

  while (clientIdsRef.current.length < roles.length) {
    clientIdsRef.current = [
      ...clientIdsRef.current,
      crypto.randomUUID(),
    ];
  }
  if (clientIdsRef.current.length > roles.length) {
    clientIdsRef.current = clientIdsRef.current.slice(0, roles.length);
  }

  function updateRole(index: number, patch: Partial<WorkExperienceRole>) {
    onChange(
      roles.map((role, i) => (i === index ? { ...role, ...patch } : role)),
    );
  }

  function addRole() {
    if (roles.length >= 3) return;
    clientIdsRef.current = [...clientIdsRef.current, crypto.randomUUID()];
    onChange([...roles, { ...EMPTY_ROLE }]);
  }

  function removeRole(index: number) {
    if (roles.length <= 1) return;
    clientIdsRef.current = clientIdsRef.current.filter((_, i) => i !== index);
    onChange(roles.filter((_, i) => i !== index));
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">
          Work Experience
        </h3>
        {roles.length < 3 ? (
          <button
            type="button"
            onClick={addRole}
            className="text-sm font-medium text-accent hover:text-accent-dark"
          >
            + Add role
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {roles.map((role, index) => {
          const start = parseYearMonth(role.start_date);
          const end = parseYearMonth(role.end_date);
          const clientId = clientIdsRef.current[index] ?? `role-${index}`;

          return (
            <div
              key={clientId}
              className="rounded-lg bg-surface-secondary p-4 sm:p-5"
            >
              {roles.length > 1 ? (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRole(index)}
                    className="text-xs font-medium text-error hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`company-${clientId}`}>Company Name</Label>
                  <Input
                    id={`company-${clientId}`}
                    value={role.company}
                    onChange={(e) =>
                      updateRole(index, { company: e.target.value })
                    }
                    placeholder="Company"
                  />
                </div>
                <div>
                  <Label htmlFor={`title-${clientId}`}>Job Title</Label>
                  <Input
                    id={`title-${clientId}`}
                    value={role.title}
                    onChange={(e) =>
                      updateRole(index, { title: e.target.value })
                    }
                    placeholder="Job title"
                  />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      aria-label={`Start month role ${index + 1}`}
                      value={start.month}
                      onChange={(e) =>
                        updateRole(index, {
                          start_date: toYearMonth(e.target.value, start.year),
                        })
                      }
                    >
                      <option value="">Month</option>
                      {MONTHS.map((name, monthIndex) => (
                        <option
                          key={name}
                          value={String(monthIndex + 1).padStart(2, "0")}
                        >
                          {name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label={`Start year role ${index + 1}`}
                      value={start.year}
                      onChange={(e) =>
                        updateRole(index, {
                          start_date: toYearMonth(start.month, e.target.value),
                        })
                      }
                    >
                      <option value="">Year</option>
                      {YEARS.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>End Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      aria-label={`End month role ${index + 1}`}
                      value={end.month}
                      disabled={role.is_current}
                      onChange={(e) =>
                        updateRole(index, {
                          end_date:
                            toYearMonth(e.target.value, end.year) || null,
                        })
                      }
                    >
                      <option value="">Month</option>
                      {MONTHS.map((name, monthIndex) => (
                        <option
                          key={name}
                          value={String(monthIndex + 1).padStart(2, "0")}
                        >
                          {name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label={`End year role ${index + 1}`}
                      value={end.year}
                      disabled={role.is_current}
                      onChange={(e) =>
                        updateRole(index, {
                          end_date:
                            toYearMonth(end.month, e.target.value) || null,
                        })
                      }
                    >
                      <option value="">Year</option>
                      {YEARS.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={role.is_current}
                      onChange={(e) =>
                        updateRole(index, {
                          is_current: e.target.checked,
                          end_date: e.target.checked ? null : role.end_date,
                        })
                      }
                      className="h-4 w-4 rounded border-border accent-[var(--color-accent)]"
                    />
                    Currently working here
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`responsibilities-${clientId}`}>
                    Key Responsibilities
                  </Label>
                  <Textarea
                    id={`responsibilities-${clientId}`}
                    rows={3}
                    value={role.responsibilities}
                    onChange={(e) =>
                      updateRole(index, { responsibilities: e.target.value })
                    }
                    placeholder="Describe your key responsibilities..."
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
