import Link from "next/link";

import { BackToJobs } from "@/components/job-details/BackToJobs";
import { Button } from "@/components/ui/button";

type JobDetailsNotFoundProps = {
  message?: string;
};

export function JobDetailsNotFound({
  message = "This job could not be found, or you do not have access to it.",
}: JobDetailsNotFoundProps) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:px-8">
      <BackToJobs />
      <section className="rounded-xl border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-semibold text-text-primary">
          Job not found
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          {message}
        </p>
        <Button className="mt-6" asChild>
          <Link href="/find-jobs" className="cursor-pointer">
            Back to Jobs
          </Link>
        </Button>
      </section>
    </main>
  );
}
