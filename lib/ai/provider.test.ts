import { afterEach, describe, expect, it, vi } from "vitest";

const { mockCreateOpenRouter, mockModel } = vi.hoisted(() => {
  const mockModel = vi.fn(() => "language-model");
  const mockCreateOpenRouter = vi.fn(() => mockModel);
  return { mockCreateOpenRouter, mockModel };
});

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: mockCreateOpenRouter,
}));

describe("getLanguageModel / OpenRouter key failover", () => {
  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEYS;
  });

  async function loadProvider() {
    const mod = await import("@/lib/ai/provider");
    mod.resetOpenRouterKeyIndexForTests();
    return mod;
  }

  it("creates openrouter/free with response-healing by default", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    const { getLanguageModel } = await loadProvider();
    const model = getLanguageModel();

    expect(mockCreateOpenRouter).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-test" }),
    );
    expect(mockModel).toHaveBeenCalledWith("openrouter/free", {
      plugins: [{ id: "response-healing" }],
    });
    expect(model).toBe("language-model");
  });

  it("parses OPENROUTER_API_KEYS with commas and newlines", async () => {
    process.env.OPENROUTER_API_KEYS = "sk-a, sk-b\nsk-c;sk-a";
    const { getOpenRouterApiKeys } = await loadProvider();
    expect(getOpenRouterApiKeys()).toEqual(["sk-a", "sk-b", "sk-c"]);
  });

  it("prefers OPENROUTER_API_KEYS over OPENROUTER_API_KEY", async () => {
    process.env.OPENROUTER_API_KEY = "sk-single";
    process.env.OPENROUTER_API_KEYS = "sk-multi-1,sk-multi-2";
    const { getOpenRouterApiKeys, getLanguageModel } = await loadProvider();

    expect(getOpenRouterApiKeys()).toEqual(["sk-multi-1", "sk-multi-2"]);
    getLanguageModel();
    expect(mockCreateOpenRouter).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-multi-1" }),
    );
  });

  it("throws when no OpenRouter keys are configured", async () => {
    const { getLanguageModel } = await loadProvider();
    expect(() => getLanguageModel()).toThrow(/OPENROUTER_API_KEYS/);
  });

  it("throws for unsupported AI_PROVIDER", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.AI_PROVIDER = "openai";
    const { getLanguageModel } = await loadProvider();
    expect(() => getLanguageModel()).toThrow("Unsupported AI_PROVIDER");
  });

  it("detects rate-limit style errors", async () => {
    const { isOpenRouterRateLimitError, isOpenRouterAuthError } =
      await loadProvider();
    expect(
      isOpenRouterRateLimitError(Object.assign(new Error("rate limited"), { statusCode: 429 })),
    ).toBe(true);
    expect(
      isOpenRouterRateLimitError(new Error("Free models limit exceeded for today")),
    ).toBe(true);
    expect(isOpenRouterRateLimitError(new Error("schema mismatch"))).toBe(false);
    expect(
      isOpenRouterAuthError(Object.assign(new Error("Unauthorized"), { statusCode: 401 })),
    ).toBe(true);
    expect(isOpenRouterAuthError(new Error("Invalid API key"))).toBe(true);
  });

  it("retries with the next key when the current key is rate-limited", async () => {
    process.env.OPENROUTER_API_KEYS = "sk-dead,sk-live";
    const { withOpenRouterKeyFailover } = await loadProvider();

    const run = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Too Many Requests"), { statusCode: 429 }),
      )
      .mockResolvedValueOnce({ ok: true });

    const result = await withOpenRouterKeyFailover(run);

    expect(result).toEqual({ ok: true });
    expect(run).toHaveBeenCalledTimes(2);
    expect(mockCreateOpenRouter).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ apiKey: "sk-dead" }),
    );
    expect(mockCreateOpenRouter).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ apiKey: "sk-live" }),
    );
  });

  it("does not rotate keys for non-rate-limit errors", async () => {
    process.env.OPENROUTER_API_KEYS = "sk-a,sk-b";
    const { withOpenRouterKeyFailover } = await loadProvider();

    const boom = new Error("schema failed");
    const run = vi.fn().mockRejectedValue(boom);

    await expect(withOpenRouterKeyFailover(run)).rejects.toThrow("schema failed");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("uses injected keys override and ignores platform env keys", async () => {
    process.env.OPENROUTER_API_KEYS = "sk-platform-a,sk-platform-b";
    const { withOpenRouterKeyFailover } = await loadProvider();

    const run = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Too Many Requests"), { statusCode: 429 }),
      )
      .mockResolvedValueOnce({ ok: true });

    const result = await withOpenRouterKeyFailover(run, {
      keys: ["sk-byok-dead", "sk-byok-live"],
    });

    expect(result).toEqual({ ok: true });
    expect(mockCreateOpenRouter).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ apiKey: "sk-byok-dead" }),
    );
    expect(mockCreateOpenRouter).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ apiKey: "sk-byok-live" }),
    );
  });

  it("passes a chat-completion fetch meter when onChatCompletionHttp is set", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    const { withOpenRouterKeyFailover } = await loadProvider();
    const onChatCompletionHttp = vi.fn();
    const run = vi.fn().mockResolvedValue({ ok: true });

    await withOpenRouterKeyFailover(run, { onChatCompletionHttp });

    expect(mockCreateOpenRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        fetch: expect.any(Function),
      }),
    );
  });
});
