import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { displayCompany } from "@/lib/job-detail";

type ApplyNowButtonProps = {
  company: string | null;
  applyUrl: string | null;
};

export function ApplyNowButton({ company, applyUrl }: ApplyNowButtonProps) {
  const companyLabel = displayCompany(company);
  const label =
    companyLabel === "Unknown company"
      ? "Apply Now"
      : `Apply Now at ${companyLabel}`;

  if (!applyUrl) {
    return (
      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-xl text-base"
        disabled
      >
        {label}
      </Button>
    );
  }

  return (
    <Button size="lg" className="h-12 w-full rounded-xl text-base" asChild>
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer"
      >
        {label}
        <ExternalLink className="size-4" aria-hidden />
      </a>
    </Button>
  );
}
