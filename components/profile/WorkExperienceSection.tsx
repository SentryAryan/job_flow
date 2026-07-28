"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

/** Radix Select forbids empty string values — keep selects always controlled. */
const SELECT_EMPTY = "__empty__";

function toSelectValue(value: string): string {
  return value || SELECT_EMPTY;
}

function fromSelectValue(value: string): string {
  return value === SELECT_EMPTY ? "" : value;
}

function parseYearMonth(value: string | null): { month: string; year: string } {
  if (!value) return { month: "", year: "" };
  const [year = "", month = ""] = value.split("-");
  return { month, year };
}

/** Persist partial month/year so selecting one field does not reset the other. */
function toYearMonth(month: string, year: string): string {
  if (!month && !year) return "";
  const paddedMonth = month ? month.padStart(2, "0") : "";
  return `${year}-${paddedMonth}`;
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
          <Button
            type="button"
            variant="link"
            onClick={addRole}
            className="h-auto p-0 text-sm font-medium text-accent hover:text-accent-dark"
          >
            + Add role
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {roles.map((role, index) => {
          const start = parseYearMonth(role.start_date);
          const end = parseYearMonth(role.end_date);
          const clientId = clientIdsRef.current[index] ?? `role-${index}`;
          const currentId = `is-current-${clientId}`;

          return (
            <div
              key={clientId}
              className="rounded-lg bg-surface-secondary p-4 sm:p-5"
            >
              {roles.length > 1 ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => removeRole(index)}
                    className="h-auto p-0 text-xs font-medium text-error hover:underline"
                  >
                    Remove
                  </Button>
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
                      value={toSelectValue(start.month)}
                      onValueChange={(value) =>
                        updateRole(index, {
                          start_date: toYearMonth(
                            fromSelectValue(value),
                            start.year,
                          ),
                        })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Start month role ${index + 1}`}
                      >
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY}>Month</SelectItem>
                        {MONTHS.map((name, monthIndex) => (
                          <SelectItem
                            key={name}
                            value={String(monthIndex + 1).padStart(2, "0")}
                          >
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={toSelectValue(start.year)}
                      onValueChange={(value) =>
                        updateRole(index, {
                          start_date: toYearMonth(
                            start.month,
                            fromSelectValue(value),
                          ),
                        })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Start year role ${index + 1}`}
                      >
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY}>Year</SelectItem>
                        {YEARS.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>End Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={toSelectValue(end.month)}
                      disabled={role.is_current}
                      onValueChange={(value) =>
                        updateRole(index, {
                          end_date:
                            toYearMonth(fromSelectValue(value), end.year) ||
                            null,
                        })
                      }
                    >
                      <SelectTrigger aria-label={`End month role ${index + 1}`}>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY}>Month</SelectItem>
                        {MONTHS.map((name, monthIndex) => (
                          <SelectItem
                            key={name}
                            value={String(monthIndex + 1).padStart(2, "0")}
                          >
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={toSelectValue(end.year)}
                      disabled={role.is_current}
                      onValueChange={(value) =>
                        updateRole(index, {
                          end_date:
                            toYearMonth(end.month, fromSelectValue(value)) ||
                            null,
                        })
                      }
                    >
                      <SelectTrigger aria-label={`End year role ${index + 1}`}>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY}>Year</SelectItem>
                        {YEARS.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Checkbox
                      id={currentId}
                      checked={role.is_current}
                      onCheckedChange={(checked) =>
                        updateRole(index, {
                          is_current: checked === true,
                          end_date: checked === true ? null : role.end_date,
                        })
                      }
                    />
                    <Label
                      htmlFor={currentId}
                      className="mb-0 cursor-pointer text-sm font-normal normal-case leading-none tracking-normal text-text-primary"
                    >
                      Currently working here
                    </Label>
                  </div>
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
