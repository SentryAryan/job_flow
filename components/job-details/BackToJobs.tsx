import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function BackToJobs() {
  return (
    <Link
      href="/find-jobs"
      className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      Back to Jobs
    </Link>
  );
}
