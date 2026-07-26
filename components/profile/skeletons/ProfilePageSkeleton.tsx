import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Resume AI usage card — title + three progress rows. */
export function ResumeAiUsageCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <Card className={cn("border-border", className)} aria-busy="true">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
        <Skeleton className="size-8 shrink-0 rounded-md" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** OpenRouter keys body only — header stays mounted in the real card. */
export function OpenRouterKeysContentSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-12 w-full rounded-md" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Skeleton className="h-9 w-full flex-1 rounded-md" />
        <Skeleton className="h-9 w-full rounded-md sm:w-28" />
      </div>
    </div>
  );
}

/** Full OpenRouter card for page-level skeleton. */
export function OpenRouterKeysCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </CardHeader>
      <CardContent>
        <OpenRouterKeysContentSkeleton />
      </CardContent>
    </Card>
  );
}

/**
 * Resume card skeleton — title, dropzone, Extract/Generate actions.
 * Preview is omitted (only present when a resume PDF already exists).
 */
export function ResumeUploadCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-36 w-full rounded-lg border border-dashed border-border" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-11 w-full rounded-md sm:w-[15.5rem]" />
          <Skeleton className="h-11 w-full rounded-md sm:w-[15.5rem]" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Profile form card — five sections + footer buttons. */
export function ProfileFormCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="pt-6">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex flex-col gap-8">
          {[0, 1, 2, 3, 4].map((section) => (
            <div key={section} className="flex flex-col gap-4">
              {section > 0 ? (
                <div className="border-t border-border pt-8" />
              ) : null}
              <Skeleton className="h-4 w-32" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md sm:col-span-2" />
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 w-full flex-1 rounded-md" />
            <Skeleton className="h-11 w-full flex-1 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Full profile main column skeleton (no Navbar).
 * Mirrors always-present sections only (completion banner is conditional and omitted).
 */
export function ProfilePageSkeleton() {
  return (
    <main
      className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 sm:px-8"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <ResumeAiUsageCardSkeleton />
      <OpenRouterKeysCardSkeleton />
      <ResumeUploadCardSkeleton />
      <ProfileFormCardSkeleton />
    </main>
  );
}
