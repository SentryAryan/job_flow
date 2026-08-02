"use client";

import { RefreshCw } from "lucide-react";
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";

import { ResumeAiUsageCardSkeleton } from "@/components/profile/skeletons/ProfilePageSkeleton";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    fetchResumeAiUsage,
    WINDOW_LABELS,
    type ResumeAiUsageData,
} from "@/lib/resume-ai-usage";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

export type ResumeAiUsageCardHandle = {
  refresh: () => Promise<void>;
};

type ResumeAiUsageCardProps = {
  className?: string;
};

function windowLabel(name: string): string {
  return WINDOW_LABELS[name] ?? name;
}

function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export const ResumeAiUsageCard = forwardRef<
  ResumeAiUsageCardHandle,
  ResumeAiUsageCardProps
>(function ResumeAiUsageCard({ className }, ref) {
  const [data, setData] = useState<ResumeAiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hasDataRef = useRef(false);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = Boolean(opts?.soft && hasDataRef.current);
    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await fetchResumeAiUsage();
      if (!mountedRef.current) return;

      if (!result.success) {
        setError(result.error);
        if (result.error.toLowerCase().includes("unauthorized")) {
          setData(null);
          hasDataRef.current = false;
        }
        return;
      }

      setError(null);
      setData(result.data);
      hasDataRef.current = true;
    } catch {
      if (mountedRef.current) {
        setError("Could not load Resume AI usage. Please try again.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => load({ soft: true }),
    }),
    [load],
  );

  useEffect(() => {
    mountedRef.current = true;
    void load();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    function clearPoll() {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function startPoll() {
      clearPoll();
      intervalId = setInterval(() => {
        if (document.hidden) return;
        void load({ soft: true });
      }, POLL_MS);
    }

    function onVisibility() {
      if (document.hidden) {
        clearPoll();
        return;
      }
      void load({ soft: true });
      startPoll();
    }

    startPoll();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      clearPoll();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  if (!loading && data && !data.available) {
    return null;
  }

  if (!loading && !data && error) {
    return null;
  }

  if (loading && !data) {
    return <ResumeAiUsageCardSkeleton className={className} />;
  }

  if (!data) {
    return null;
  }

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold text-text-primary">
            Resume AI usage
          </CardTitle>
          <CardDescription className="mt-1 text-sm text-text-secondary">
            Extract from Resume, Generate Resume, and Find Jobs share these
            limits.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="shrink-0"
          aria-label="Refresh Resume AI usage"
          disabled={refreshing}
          onClick={() => void load({ soft: true })}
        >
          <RefreshCw className={cn(refreshing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-xs text-error" role="status">
            {error}
          </p>
        ) : null}
        {data.windows.map((window) => {
          const pct = usagePercent(window.used, window.limit);
          const nearLimit =
            window.remaining <= Math.max(1, Math.floor(window.limit * 0.15));
          return (
            <div key={window.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-text-primary">
                  {windowLabel(window.name)}
                </span>
                <span
                  className={cn(
                    "tabular-nums text-text-secondary",
                    nearLimit && "font-medium text-warning",
                  )}
                >
                  {window.used} / {window.limit} used
                </span>
              </div>
              <Progress
                value={pct}
                className="h-2 bg-surface-tertiary"
                aria-label={`${windowLabel(window.name)}: ${window.used} of ${window.limit} used`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});
