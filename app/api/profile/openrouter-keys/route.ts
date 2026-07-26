import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import {
    createStoredKey,
    decryptStoredPlaintexts,
    isValidOpenRouterKeyFormat,
    loadStoredByokKeys,
    MAX_BYOK_KEYS,
    saveStoredByokKeys,
    toMaskedKeys,
    type StoredByokKey,
} from "@/lib/byok-keys";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import { validateOpenRouterApiKey } from "@/lib/openrouter-key-validate";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ success: false, error, data: null }, { status });
}

function isCryptoConfigError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("BYOK_ENCRYPTION_SECRET")
  );
}

function cryptoUnavailable() {
  return jsonError(
    503,
    "OpenRouter key storage is temporarily unavailable. Please try again later.",
  );
}

function successPayload(keys: StoredByokKey[]) {
  const masked = toMaskedKeys(keys);
  return {
    success: true as const,
    data: {
      keys: masked,
      hasKeys: masked.length > 0,
    },
    error: null,
  };
}

function parseIncomingKeys(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  if (typeof record.key === "string") {
    const trimmed = record.key.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(record.keys)) {
    return record.keys
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return null;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  try {
    const client = createAuthedInsforgeClient(auth.accessToken);
    const keys = await loadStoredByokKeys(auth.user.id, client);
    return NextResponse.json(successPayload(keys));
  } catch (error) {
    if (isCryptoConfigError(error)) {
      return cryptoUnavailable();
    }
    console.error("[api/profile/openrouter-keys] GET", error);
    return jsonError(502, "Could not load OpenRouter keys.");
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const incoming = parseIncomingKeys(body);
  if (incoming === null) {
    return jsonError(400, "Provide a key string or keys array");
  }
  if (incoming.length === 0) {
    return jsonError(400, "OpenRouter API key is required");
  }

  for (const key of incoming) {
    if (!isValidOpenRouterKeyFormat(key)) {
      return jsonError(
        400,
        "That doesn’t look like an OpenRouter key. It should start with sk-.",
      );
    }
  }

  for (const key of incoming) {
    const check = await validateOpenRouterApiKey(key);
    if (!check.ok) {
      return jsonError(400, check.error);
    }
  }

  try {
    const client = createAuthedInsforgeClient(auth.accessToken);
    const existing = await loadStoredByokKeys(auth.user.id, client);

    const existingPlain = new Set(decryptStoredPlaintexts(existing));

    const next: StoredByokKey[] = [...existing];
    for (const plaintext of incoming) {
      if (existingPlain.has(plaintext)) continue;
      if (next.length >= MAX_BYOK_KEYS) {
        return jsonError(
          400,
          `You can save at most ${MAX_BYOK_KEYS} OpenRouter keys.`,
        );
      }
      next.push(createStoredKey(plaintext));
      existingPlain.add(plaintext);
    }

    const saved = await saveStoredByokKeys(auth.user.id, client, next);
    return NextResponse.json(successPayload(saved));
  } catch (error) {
    if (isCryptoConfigError(error)) {
      return cryptoUnavailable();
    }
    console.error("[api/profile/openrouter-keys] POST", error);
    return jsonError(502, "Could not save OpenRouter key.");
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const id =
    body && typeof body === "object" && typeof (body as { id?: unknown }).id === "string"
      ? (body as { id: string }).id.trim()
      : "";

  if (!id) {
    return jsonError(400, "Key id is required");
  }

  try {
    const client = createAuthedInsforgeClient(auth.accessToken);
    const existing = await loadStoredByokKeys(auth.user.id, client);
    const next = existing.filter((key) => key.id !== id);

    if (next.length === existing.length) {
      return jsonError(404, "OpenRouter key not found");
    }

    const saved = await saveStoredByokKeys(auth.user.id, client, next);
    return NextResponse.json(successPayload(saved));
  } catch (error) {
    if (isCryptoConfigError(error)) {
      return cryptoUnavailable();
    }
    console.error("[api/profile/openrouter-keys] DELETE", error);
    return jsonError(502, "Could not remove OpenRouter key.");
  }
}
