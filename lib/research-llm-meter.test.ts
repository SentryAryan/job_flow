import { describe, expect, it, vi } from "vitest";

import {
    createOpenRouterChatCompletionFetch,
    ResearchLlmMeter,
} from "@/lib/research-llm-meter";

describe("ResearchLlmMeter", () => {
  it("increments, peeks, and consumes", () => {
    const meter = new ResearchLlmMeter();
    meter.increment(2);
    meter.increment(1);
    expect(meter.peek()).toBe(3);
    expect(meter.consume()).toBe(3);
    expect(meter.peek()).toBe(0);
    expect(meter.consume()).toBe(0);
  });

  it("ignores non-positive increments", () => {
    const meter = new ResearchLlmMeter();
    meter.increment(0);
    meter.increment(-2);
    meter.increment(1.9);
    expect(meter.consume()).toBe(1);
  });

  it("soft-caps at RESEARCH_MAX_OPENROUTER_CALLS", () => {
    const meter = new ResearchLlmMeter();
    meter.increment(4);
    meter.increment(2);
    expect(meter.peek()).toBe(5);
    expect(meter.isAtCap()).toBe(true);
    meter.increment(10);
    expect(meter.peek()).toBe(5);
  });
});

describe("createOpenRouterChatCompletionFetch", () => {
  it("invokes callback for chat/completions URLs", async () => {
    const onChat = vi.fn();
    const inner = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", inner);

    const wrapped = createOpenRouterChatCompletionFetch(onChat);
    await wrapped("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
    });
    await wrapped("https://openrouter.ai/api/v1/models", { method: "GET" });

    expect(onChat).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });
});
