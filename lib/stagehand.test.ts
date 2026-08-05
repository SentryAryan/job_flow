import { describe, expect, it, vi } from "vitest";

import {
    buildResearchStagehandLlmClient,
    DEFAULT_RESEARCH_MODEL,
    OPENROUTER_CHAT_BASE_URL,
    quietStagehandLogger,
    wrapOpenAiClientForStagehand,
} from "@/lib/stagehand";
import { healChatCompletionContent } from "@/lib/stagehand-response-heal";

vi.mock("@browserbasehq/stagehand", () => {
  class MockCustomOpenAIClient {
    type = "openai";
    modelName: string;
    client: {
      apiKey: string;
      baseURL: string;
      chat: { completions: { create: ReturnType<typeof vi.fn> } };
    };
    createChatCompletion = vi.fn(async () => ({ choices: [] }));

    constructor(opts: {
      modelName: string;
      client: MockCustomOpenAIClient["client"];
    }) {
      this.modelName = opts.modelName;
      this.client = opts.client;
    }
  }

  return {
    CustomOpenAIClient: MockCustomOpenAIClient,
    Stagehand: vi.fn().mockImplementation(() => ({
      init: vi.fn(),
      close: vi.fn(),
    })),
  };
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      apiKey: string;
      baseURL: string;
      chat = {
        completions: {
          create: vi.fn(async () => ({
            choices: [{ message: { content: "{}" } }],
          })),
        },
      };
      constructor(opts: { apiKey: string; baseURL: string }) {
        this.apiKey = opts.apiKey;
        this.baseURL = opts.baseURL;
      }
    },
  };
});

describe("buildResearchStagehandLlmClient", () => {
  it("uses CustomOpenAIClient with OpenRouter base URL and model id", () => {
    const client = buildResearchStagehandLlmClient({
      openRouterApiKey: "sk-or-test",
      modelId: "openrouter/free",
    });

    expect(client.modelName).toBe("openrouter/free");
    expect(client.client.apiKey).toBe("sk-or-test");
    expect(client.client.baseURL).toBe(OPENROUTER_CHAT_BASE_URL);
  });

  it("defaults model to openrouter/free when unset", () => {
    const prev = process.env.AI_MODEL;
    delete process.env.AI_MODEL;
    try {
      const client = buildResearchStagehandLlmClient({
        openRouterApiKey: "sk-or-test",
      });
      expect(client.modelName).toBe(DEFAULT_RESEARCH_MODEL);
    } finally {
      if (prev !== undefined) process.env.AI_MODEL = prev;
    }
  });

  it("counts createChatCompletion calls via consumeLlmCallCount and onLlmCall", async () => {
    const onLlmCall = vi.fn();
    const client = buildResearchStagehandLlmClient({
      openRouterApiKey: "sk-or-test",
      modelId: "openrouter/free",
      onLlmCall,
    });

    await client.createChatCompletion({
      options: { messages: [] },
      logger: () => undefined,
    } as never);
    await client.createChatCompletion({
      options: { messages: [] },
      logger: () => undefined,
    } as never);

    expect(onLlmCall).toHaveBeenCalledTimes(2);
    expect(client.consumeLlmCallCount()).toBe(2);
    expect(client.consumeLlmCallCount()).toBe(0);
  });
});

describe("wrapOpenAiClientForStagehand", () => {
  it("heals null content via chat.completions.create wrapper", async () => {
    const create = vi.fn(async () => ({
      choices: [
        {
          message: {
            content: null,
            reasoning: '{"completed":true}',
          },
        },
      ],
    }));
    const client = {
      chat: { completions: { create } },
    };

    wrapOpenAiClientForStagehand(client as never);
    const response = await client.chat.completions.create({} as never);

    expect(healChatCompletionContent(response as never).choices?.[0]?.message)
      .toMatchObject({ content: '{"completed":true}' });
    expect(response.choices[0]?.message?.content).toBe('{"completed":true}');
  });
});

describe("quietStagehandLogger", () => {
  it("ignores info/debug lines (level > 0)", () => {
    expect(() =>
      quietStagehandLogger({
        level: 1,
        message: "Starting extraction using a11y snapshot",
        auxiliary: {
          instruction: { value: "huge", type: "string" },
        },
      }),
    ).not.toThrow();
  });
});
