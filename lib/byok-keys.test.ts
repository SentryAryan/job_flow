import { afterEach, describe, expect, it, vi } from "vitest";

import {
    createStoredKey,
    decryptKey,
    encryptKey,
    isValidOpenRouterKeyFormat,
    maskLast4,
    parseStoredKeys,
} from "@/lib/byok-keys";

describe("byok-keys crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("masks last4", () => {
    expect(maskLast4("sk-or-v1-abcdefgh")).toBe("efgh");
  });

  it("validates OpenRouter key format", () => {
    expect(isValidOpenRouterKeyFormat("sk-or-v1-abcdefgh")).toBe(true);
    expect(isValidOpenRouterKeyFormat("not-a-key")).toBe(false);
    expect(isValidOpenRouterKeyFormat("sk-short")).toBe(false);
  });

  it("round-trips encrypt/decrypt", () => {
    vi.stubEnv("BYOK_ENCRYPTION_SECRET", "test-secret-for-unit-tests");
    const plaintext = "sk-or-v1-unit-test-key-abcdef";
    const encrypted = encryptKey(plaintext);
    expect(encrypted.last4).toBe("cdef");
    expect(decryptKey(encrypted)).toBe(plaintext);
  });

  it("createStoredKey includes id and timestamp", () => {
    vi.stubEnv("BYOK_ENCRYPTION_SECRET", "test-secret-for-unit-tests");
    const stored = createStoredKey("sk-or-v1-another-key-zzzz");
    expect(stored.id).toBeTruthy();
    expect(stored.created_at).toBeTruthy();
    expect(decryptKey(stored)).toBe("sk-or-v1-another-key-zzzz");
  });

  it("parseStoredKeys ignores malformed entries", () => {
    expect(
      parseStoredKeys([
        {
          id: "a",
          ciphertext: "c",
          iv: "i",
          tag: "t",
          last4: "1234",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        { id: "bad" },
      ]),
    ).toHaveLength(1);
  });

  it("throws when encryption secret missing", () => {
    vi.stubEnv("BYOK_ENCRYPTION_SECRET", "");
    expect(() => encryptKey("sk-or-v1-abcdefghijkl")).toThrow(
      /BYOK_ENCRYPTION_SECRET/,
    );
  });
});
