import { describe, expect, it } from "vitest";

import {
    extractAssistantTextFromMessage,
    healChatCompletionContent,
} from "@/lib/stagehand-response-heal";

describe("extractAssistantTextFromMessage", () => {
  it("prefers content when present", () => {
    expect(
      extractAssistantTextFromMessage({
        content: '{"completed":true}',
        reasoning: "ignore",
      }),
    ).toBe('{"completed":true}');
  });

  it("falls back to reasoning string", () => {
    expect(
      extractAssistantTextFromMessage({
        content: null,
        reasoning: '{\n  "completed": true\n}\n',
      }),
    ).toBe('{\n  "completed": true\n}');
  });

  it("falls back to reasoning_details text", () => {
    expect(
      extractAssistantTextFromMessage({
        content: "",
        reasoning_details: [
          { type: "reasoning.text", text: '{"progress":"ok","completed":true}' },
        ],
      }),
    ).toBe('{"progress":"ok","completed":true}');
  });
});

describe("healChatCompletionContent", () => {
  it("fills null content from reasoning", () => {
    const healed = healChatCompletionContent({
      id: "gen-1",
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            reasoning: '{"completed":true,"progress":"done"}',
          },
        },
      ],
    });

    expect(healed.choices?.[0]?.message?.content).toBe(
      '{"completed":true,"progress":"done"}',
    );
  });

  it("leaves responses with content unchanged", () => {
    const original = {
      choices: [{ message: { content: '{"a":1}', reasoning: "x" } }],
    };
    expect(healChatCompletionContent(original)).toEqual(original);
  });
});
