import { afterEach, describe, expect, it, vi } from "vitest";

import { validateOpenRouterApiKey } from "@/lib/openrouter-key-validate";

describe("validateOpenRouterApiKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    await expect(
      validateOpenRouterApiKey("sk-or-v1-abcdefghijkl", fetchImpl),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/key",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer sk-or-v1-abcdefghijkl" },
      }),
    );
  });

  it("rejects invalid keys with 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    const result = await validateOpenRouterApiKey(
      "sk-or-v1-badkeyxxxxxx",
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/isn’t valid/i);
    }
  });

  it("handles network failures", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await validateOpenRouterApiKey(
      "sk-or-v1-abcdefghijkl",
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Could not reach OpenRouter/i);
    }
  });
});
