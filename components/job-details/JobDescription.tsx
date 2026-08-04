"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { stripHtmlToText } from "@/lib/job-detail";

const COLLAPSE_AT = 400;

type JobDescriptionProps = {
  aboutRole: string | null;
  responsibilities?: string[];
  requirements?: string[];
  niceToHave?: string[];
  benefits?: string[];
  aboutCompany?: string | null;
  /** External Adzuna / apply URL — same destination as View Job Post. */
  viewUrl?: string | null;
};

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-dark">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function JobDescription({
  aboutRole,
  responsibilities = [],
  requirements = [],
  niceToHave = [],
  benefits = [],
  aboutCompany = null,
  viewUrl = null,
}: JobDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const fullText = stripHtmlToText(aboutRole);
  const needsCollapse = fullText.length > COLLAPSE_AT;
  const visibleText =
    needsCollapse && !expanded
      ? `${fullText.slice(0, COLLAPSE_AT).trimEnd()}…`
      : fullText;
  const showActions = needsCollapse || Boolean(viewUrl);

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-center gap-2">
        <FileText className="size-4 shrink-0 text-text-secondary" aria-hidden />
        <h2 className="text-base font-semibold text-text-primary">
          Job Description
        </h2>
      </div>

      {fullText ? (
        <>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-text-dark">
            {visibleText}
          </p>
          {showActions ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {needsCollapse ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-accent hover:bg-transparent hover:text-accent-dark"
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? "Show less" : "Show more"}
                </Button>
              ) : null}
              {viewUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-accent hover:bg-transparent hover:text-accent-dark"
                  asChild
                >
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer"
                  >
                    View full post
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-text-secondary">
            No job description available.
          </p>
          {viewUrl ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-auto px-0 text-accent hover:bg-transparent hover:text-accent-dark"
              asChild
            >
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer"
              >
                View full post
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          ) : null}
        </>
      )}

      <BulletList title="Responsibilities" items={responsibilities} />
      <BulletList title="Requirements" items={requirements} />
      <BulletList title="Nice to have" items={niceToHave} />
      <BulletList title="Benefits" items={benefits} />

      {aboutCompany?.trim() ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-text-primary">
            About the company
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-dark">
            {stripHtmlToText(aboutCompany)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
