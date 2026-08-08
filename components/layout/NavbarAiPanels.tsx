"use client";

import { KeyRound, RefreshCw, Trash2 } from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
    addOpenRouterKey,
    fetchOpenRouterKeys,
    removeOpenRouterKey,
    type MaskedOpenRouterKey,
} from "@/lib/openrouter-keys-client";
import {
    fetchResumeAiUsage,
    WINDOW_LABELS,
    type ResumeAiUsageData,
} from "@/lib/resume-ai-usage";
import { cn } from "@/lib/utils";

function windowLabel(name: string): string {
  return WINDOW_LABELS[name] ?? name;
}

function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

type NavbarAiUsagePanelProps = {
  refreshToken?: number;
  className?: string;
};

/** Compact shared AI usage (Extract / Generate / Find Jobs / Research) for the avatar menu. */
export function NavbarAiUsagePanel({
  refreshToken = 0,
  className,
}: NavbarAiUsagePanelProps) {
  const [data, setData] = useState<ResumeAiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetchResumeAiUsage();
      if (!mountedRef.current) return;
      if (!result.success) {
        setData(null);
        return;
      }
      setData(result.data);
    } catch {
      if (mountedRef.current) setData(null);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load, refreshToken]);

  if (loading && !data) {
    return (
      <div className={cn("px-2 py-2", className)}>
        <p className="text-xs text-text-muted">Loading usage…</p>
      </div>
    );
  }

  if (!data?.available) {
    return (
      <div className={cn("flex flex-col gap-1 px-2 py-2", className)}>
        <p className="text-xs font-semibold text-text-primary">AI usage</p>
        <p className="text-[11px] leading-snug text-text-secondary">
          Limits hidden in development, with your own OpenRouter keys, or when
          Redis is not configured.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 px-2 py-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text-primary">AI usage</p>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="size-7 shrink-0 cursor-pointer"
          aria-label="Refresh AI usage"
          disabled={refreshing}
          onClick={() => void load(true)}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-text-secondary">
        Shared by Extract, Generate, Find Jobs, and Company Research.
      </p>
      {data.windows.map((window) => {
        const pct = usagePercent(window.used, window.limit);
        return (
          <div key={window.name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text-primary">{windowLabel(window.name)}</span>
              <span className="tabular-nums text-text-secondary">
                {window.used}/{window.limit}
              </span>
            </div>
            <Progress value={pct} className="h-1.5 bg-surface-tertiary" />
          </div>
        );
      })}
    </div>
  );
}

type NavbarOpenRouterKeysPanelProps = {
  onKeysChanged?: () => void;
  className?: string;
};

/** Compact OpenRouter key add/list for the avatar menu. */
export function NavbarOpenRouterKeysPanel({
  onKeysChanged,
  className,
}: NavbarOpenRouterKeysPanelProps) {
  const [keys, setKeys] = useState<MaskedOpenRouterKey[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOpenRouterKeys();
      if (!result.success) {
        setKeys([]);
        return;
      }
      setKeys(result.data.keys);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const result = await addOpenRouterKey(trimmed);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setKeys(result.data.keys);
      setInput("");
      toast.success("Key saved — AI features will use your OpenRouter account");
      onKeysChanged?.();
    } catch {
      toast.error("Could not save your key. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const result = await removeOpenRouterKey(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setKeys(result.data.keys);
      toast.success(
        result.data.hasKeys
          ? "Key removed"
          : "Key removed — Job Flow keys and usage limits apply again",
      );
      onKeysChanged?.();
    } catch {
      toast.error("Could not remove your key. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 px-2 py-2", className)}>
      <p className="text-xs font-semibold text-text-primary">OpenRouter keys</p>
      <p className="text-[11px] leading-snug text-text-secondary">
        Optional. Your keys skip Job Flow limits for Extract, Generate, Find
        Jobs, and Company Research.
      </p>

      {loading ? (
        <p className="text-[11px] text-text-muted">Loading keys…</p>
      ) : null}

      {!loading && keys.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-2 py-1.5"
            >
              <span className="font-mono text-[11px] text-text-primary">
                ••••{key.last4}
              </span>
              <Button
                type="button"
                variant="danger"
                size="icon-sm"
                className="size-7 cursor-pointer disabled:cursor-not-allowed"
                disabled={removingId === key.id}
                onClick={() => void handleRemove(key.id)}
                aria-label={`Remove key ending in ${key.last4}`}
              >
                {removingId === key.id ? (
                  <Spinner size="sm" label="Removing" />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading ? (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="flex flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Label htmlFor="navbar-openrouter-key" className="sr-only">
            OpenRouter key
          </Label>
          <Input
            id="navbar-openrouter-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-or-v1-…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={saving}
            className="h-8 font-mono text-xs"
            onKeyDown={(e) => e.stopPropagation()}
          />
          <Button
            type="submit"
            size="sm"
            className="cursor-pointer disabled:cursor-not-allowed"
            disabled={saving || !input.trim()}
          >
            {saving ? (
              <Spinner size="sm" label="Saving" />
            ) : (
              <KeyRound className="size-3.5" aria-hidden />
            )}
            Add key
          </Button>
        </form>
      ) : null}
    </div>
  );
}
