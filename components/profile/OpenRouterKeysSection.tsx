"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { insforge } from "@/lib/insforge-client";
import {
    addOpenRouterKey,
    fetchOpenRouterKeys,
    removeOpenRouterKey,
    type MaskedOpenRouterKey,
} from "@/lib/openrouter-keys-client";
import { cn } from "@/lib/utils";

type OpenRouterKeysSectionProps = {
  className?: string;
  onKeysChanged?: () => void;
};

export function OpenRouterKeysSection({
  className,
  onKeysChanged,
}: OpenRouterKeysSectionProps) {
  const [keys, setKeys] = useState<MaskedOpenRouterKey[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await insforge.getHttpClient().getValidAccessToken();
      if (!token) {
        setError("Sign in to manage your OpenRouter keys");
        setKeys([]);
        return;
      }
      const result = await fetchOpenRouterKeys(token);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      setKeys(result.data.keys);
    } catch {
      setError("Could not load your keys. Please try again.");
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
      const token = await insforge.getHttpClient().getValidAccessToken();
      if (!token) {
        toast.error("Sign in to add an OpenRouter key");
        return;
      }
      const result = await addOpenRouterKey(token, trimmed);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setKeys(result.data.keys);
      setInput("");
      toast.success("Key saved — Extract and Generate will use your OpenRouter account");
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
      const token = await insforge.getHttpClient().getValidAccessToken();
      if (!token) {
        toast.error("Sign in to remove a key");
        return;
      }
      const result = await removeOpenRouterKey(token, id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setKeys(result.data.keys);
      toast.success(
        result.data.hasKeys
          ? "Key removed"
          : "Key removed — JobPilot keys and usage limits apply again",
      );
      onKeysChanged?.();
    } catch {
      toast.error("Could not remove your key. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  const hasKeys = keys.length > 0;

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-text-primary">
          Your OpenRouter keys
        </CardTitle>
        <CardDescription className="text-sm text-text-secondary">
          Optional. Add a key from{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer font-medium text-accent underline-offset-2 hover:underline"
          >
            openrouter.ai
          </a>{" "}
          to use your own AI credits for Extract and Generate — with no JobPilot
          usage limits. We check the key when you add it, store it encrypted, and
          only show the last 4 characters. If something goes wrong, remove your
          keys here to switch back to JobPilot’s keys (with usage limits).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Spinner size="sm" label="Loading keys" />
            Loading keys…
          </div>
        ) : null}

        {!loading && error ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && hasKeys ? (
          <p
            className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-secondary"
            role="status"
          >
            You’re using your own keys. Extract and Generate won’t count toward
            JobPilot limits. Remove all keys below to use JobPilot’s keys again.
          </p>
        ) : null}

        {!loading && !error && hasKeys ? (
          <ul className="flex flex-col gap-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-3 py-2"
              >
                <span className="font-mono text-sm text-text-primary">
                  ••••{key.last4}
                </span>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="cursor-pointer disabled:cursor-not-allowed"
                  disabled={removingId === key.id}
                  onClick={() => void handleRemove(key.id)}
                  aria-label={`Remove key ending in ${key.last4}`}
                >
                  {removingId === key.id ? (
                    <Spinner size="sm" label="Removing" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && !hasKeys ? (
          <p className="text-sm text-text-secondary">
            No personal keys yet — JobPilot’s keys and usage limits apply.
          </p>
        ) : null}

        <form onSubmit={(e) => void handleAdd(e)} className="flex flex-col gap-2">
          <Label htmlFor="openrouter-key" className="text-sm text-text-primary">
            Paste a key, then add
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="openrouter-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-v1-…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={saving || loading}
              className="font-mono"
            />
            <Button
              type="submit"
              className="cursor-pointer shrink-0 disabled:cursor-not-allowed"
              disabled={saving || loading || !input.trim()}
            >
              {saving ? (
                <Spinner size="sm" label="Saving" />
              ) : (
                <KeyRound className="size-4" aria-hidden />
              )}
              Add key
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
