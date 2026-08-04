/**
 * Heal OpenRouter/free-model chat responses where JSON lives in `reasoning`
 * (or reasoning_details) but `message.content` is null — Stagehand throws
 * CreateChatCompletionResponseError: No content in response.
 */

function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text.trim();
    if (typeof record.content === "string") return record.content.trim();
  }
  return "";
}

/**
 * Pull usable assistant text from reasoning fields when content is empty.
 */
export function extractAssistantTextFromMessage(message: {
  content?: unknown;
  reasoning?: unknown;
  reasoning_details?: unknown;
}): string | null {
  const content = textFromUnknown(message.content);
  if (content) return content;

  const fromReasoning = textFromUnknown(message.reasoning);
  if (fromReasoning) return fromReasoning;

  const details = message.reasoning_details;
  if (Array.isArray(details)) {
    for (const part of details) {
      const text = textFromUnknown(part);
      if (text) return text;
    }
  }

  return null;
}

type ChatCompletionLike = {
  choices?: Array<{
    message?: {
      content?: unknown;
      reasoning?: unknown;
      reasoning_details?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

/**
 * Return a shallow-cloned completion with content filled from reasoning when needed.
 */
export function healChatCompletionContent<T extends ChatCompletionLike>(
  response: T,
): T {
  const choice = response.choices?.[0];
  const message = choice?.message;
  if (!message) return response;

  if (textFromUnknown(message.content)) return response;

  const healed = extractAssistantTextFromMessage(message);
  if (!healed) return response;

  const choices = [...(response.choices ?? [])];
  const first = { ...choice!, message: { ...message, content: healed } };
  choices[0] = first;

  return { ...response, choices };
}
