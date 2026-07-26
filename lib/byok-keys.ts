import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import type { createClient } from "@insforge/sdk";

export const MAX_BYOK_KEYS = 5;

/** Shown when the user's saved OpenRouter keys fail auth or quota (no platform fallback). */
export const BYOK_KEYS_FAILED_USER_MESSAGE =
  "Your OpenRouter key isn’t working or is out of quota. Update or remove it under Your OpenRouter keys to use JobPilot’s keys (with usage limits).";

export type StoredByokKey = {
  id: string;
  ciphertext: string;
  iv: string;
  tag: string;
  last4: string;
  created_at: string;
};

export type MaskedByokKey = {
  id: string;
  last4: string;
  createdAt: string;
};

type InsforgeClient = ReturnType<typeof createClient>;

function getEncryptionSecret(): Buffer {
  const secret = process.env.BYOK_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new Error("BYOK_ENCRYPTION_SECRET is not configured");
  }
  // Derive a stable 32-byte key from any secret length.
  return createHash("sha256").update(secret, "utf8").digest();
}

export function maskLast4(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}

export function isValidOpenRouterKeyFormat(apiKey: string): boolean {
  const trimmed = apiKey.trim();
  return trimmed.startsWith("sk-") && trimmed.length >= 12;
}

export function encryptKey(plaintext: string): Omit<StoredByokKey, "id" | "created_at"> {
  const key = getEncryptionSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext.trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    last4: maskLast4(plaintext),
  };
}

export function decryptKey(stored: Pick<StoredByokKey, "ciphertext" | "iv" | "tag">): string {
  const key = getEncryptionSecret();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(stored.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(stored.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Decrypt one stored key. Returns null for corrupt/rotated-secret rows
 * so callers can skip them. Missing `BYOK_ENCRYPTION_SECRET` still throws
 * (fail closed).
 */
export function tryDecryptKey(
  stored: Pick<StoredByokKey, "id" | "ciphertext" | "iv" | "tag">,
): string | null {
  try {
    const plaintext = decryptKey(stored).trim();
    return plaintext || null;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("BYOK_ENCRYPTION_SECRET")
    ) {
      throw error;
    }
    console.warn(
      "[byok-keys] skipping undecryptable OpenRouter key",
      typeof stored.id === "string" ? stored.id : "(unknown)",
    );
    return null;
  }
}

/** Decrypt all stored keys, skipping undecryptable entries. */
export function decryptStoredPlaintexts(stored: StoredByokKey[]): string[] {
  const plaintext: string[] = [];
  const seen = new Set<string>();

  for (const item of stored) {
    const key = tryDecryptKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    plaintext.push(key);
  }

  return plaintext;
}

export function parseStoredKeys(value: unknown): StoredByokKey[] {
  if (!Array.isArray(value)) return [];
  const keys: StoredByokKey[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.ciphertext !== "string" ||
      typeof row.iv !== "string" ||
      typeof row.tag !== "string" ||
      typeof row.last4 !== "string" ||
      typeof row.created_at !== "string"
    ) {
      continue;
    }
    keys.push({
      id: row.id,
      ciphertext: row.ciphertext,
      iv: row.iv,
      tag: row.tag,
      last4: row.last4,
      created_at: row.created_at,
    });
  }

  return keys;
}

export function toMaskedKeys(stored: StoredByokKey[]): MaskedByokKey[] {
  return stored.map((key) => ({
    id: key.id,
    last4: key.last4,
    createdAt: key.created_at,
  }));
}

export function createStoredKey(plaintext: string): StoredByokKey {
  const encrypted = encryptKey(plaintext);
  return {
    id: randomUUID(),
    ...encrypted,
    created_at: new Date().toISOString(),
  };
}

export async function loadStoredByokKeys(
  userId: string,
  client: InsforgeClient,
): Promise<StoredByokKey[]> {
  const { data, error } = await client.database
    .from("profiles")
    .select("openrouter_keys_enc")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  const row = data as Record<string, unknown> | null;
  return parseStoredKeys(row?.openrouter_keys_enc);
}

export async function userHasByokKeys(
  userId: string,
  client: InsforgeClient,
): Promise<boolean> {
  const keys = await loadStoredByokKeys(userId, client);
  return keys.length > 0;
}

export async function loadDecryptedOpenRouterKeys(
  userId: string,
  client: InsforgeClient,
): Promise<string[]> {
  const stored = await loadStoredByokKeys(userId, client);
  if (stored.length === 0) return [];
  return decryptStoredPlaintexts(stored);
}

export async function saveStoredByokKeys(
  userId: string,
  client: InsforgeClient,
  keys: StoredByokKey[],
): Promise<StoredByokKey[]> {
  const { data, error } = await client.database
    .from("profiles")
    .update({ openrouter_keys_enc: keys })
    .eq("id", userId)
    .select("openrouter_keys_enc")
    .single();

  if (error) {
    throw error;
  }

  const row = data as Record<string, unknown> | null;
  return parseStoredKeys(row?.openrouter_keys_enc);
}
