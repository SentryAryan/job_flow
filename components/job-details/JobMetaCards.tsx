import type { LucideIcon } from "lucide-react";
import { Briefcase, Calendar, DollarSign, MapPin } from "lucide-react";

import { formatRelativeFoundAt } from "@/lib/find-jobs-list";
import {
    displayLocation,
    displaySalary,
    formatJobType,
} from "@/lib/job-detail";
import { cn } from "@/lib/utils";

type JobMetaCardsProps = {
  salary: string | null;
  location: string | null;
  jobType: string | null;
  foundAt: string;
};

type MetaCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
  valueTitle?: string;
};

function MetaCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  valueTitle,
}: MetaCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            iconClassName,
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-text-primary"
            title={valueTitle ?? value}
          >
            {value}
          </p>
          <p className="mt-0.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export function JobMetaCards({
  salary,
  location,
  jobType,
  foundAt,
}: JobMetaCardsProps) {
  const locationValue = displayLocation(location);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetaCard
        label="Salary Est."
        value={displaySalary(salary)}
        icon={DollarSign}
        iconClassName="bg-success-lightest text-success-dark"
      />
      <MetaCard
        label="Location"
        value={locationValue}
        valueTitle={locationValue !== "—" ? locationValue : undefined}
        icon={MapPin}
        iconClassName="bg-info-lightest text-info-dark"
      />
      <MetaCard
        label="Job Type"
        value={formatJobType(jobType)}
        icon={Briefcase}
        iconClassName="bg-accent-light text-accent"
      />
      <MetaCard
        label="Date Found"
        value={formatRelativeFoundAt(foundAt)}
        icon={Calendar}
        iconClassName="bg-surface-muted text-text-secondary"
      />
    </div>
  );
}
