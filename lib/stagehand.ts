import {
    CustomOpenAIClient,
    Stagehand,
} from "@browserbasehq/stagehand";
import OpenAI from "openai";

import { getBrowserbaseCredentials } from "@/lib/browserbase";
import { createLogger } from "@/lib/logger";
import { healChatCompletionContent } from "@/lib/stagehand-response-heal";

const log = createLogger("stagehand");

type StagehandLogLine = {
  category?: string;
  message?: string;
  level?: 0 | 1 | 2;
};

/**
 * Quiet Stagehand logger — errors/warnings only, message string only.
 * Suppresses a11y DOM dumps and chat completion payloads.
 */
export function quietStagehandLogger(line: StagehandLogLine): void {
  const level = line.level ?? 1;
  if (level > 0) return;

  const message = (line.message ?? "").slice(0, 240);
  if (!message) return;

  log.warn(
    {
      category: line.category,
    },
    message,
  );
}

export const OPENROUTER_CHAT_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_RESEARCH_MODEL = "openrouter/free";

export type CreateResearchStagehandOptions = {
  /** Existing Browserbase session id. */
  sessionId: string;
  /** OpenRouter API key (platform or BYOK). */
  openRouterApiKey: string;
  /** Called once per Stagehand chat completion (extract + completion-check). */
  onLlmCall?: () => void;
};

export type CountingLlmClient = CustomOpenAIClient & {
  /** Return LLM chat-completion count since last consume, then reset to 0. */
  consumeLlmCallCount: () => number;
};

/**
 * Wrap OpenAI chat.completions.create so free models that put JSON only in
 * `reasoning` still satisfy Stagehand's non-null `message.content` check.
 */
export function wrapOpenAiClientForStagehand(client: OpenAI): OpenAI {
  const completions = client.chat.completions;
  const originalCreate = completions.create.bind(completions);

  completions.create = (async (...args: unknown[]) => {
    const response = await originalCreate(
      ...(args as Parameters<typeof completions.create>),
    );
    return healChatCompletionContent(response as never) as never;
  }) as unknown as typeof completions.create;

  return client;
}

/**
 * OpenRouter via Stagehand's CustomOpenAIClient (OpenAI-compatible chat).
 * Do NOT pass `model: { modelName: "openrouter/..." }` — Stagehand's AI SDK
 * resolver treats the prefix as an unsupported provider.
 *
 * Counts each createChatCompletion so Research usage can match OpenRouter calls
 * (extract + completion-check per Stagehand extract).
 */
export function buildResearchStagehandLlmClient(options: {
  openRouterApiKey: string;
  modelId?: string;
  onLlmCall?: () => void;
}): CountingLlmClient {
  const modelName =
    options.modelId?.trim() ||
    process.env.AI_MODEL?.trim() ||
    DEFAULT_RESEARCH_MODEL;

  const openAi = wrapOpenAiClientForStagehand(
    new OpenAI({
      apiKey: options.openRouterApiKey,
      baseURL: OPENROUTER_CHAT_BASE_URL,
    }),
  );

  const client = new CustomOpenAIClient({
    modelName,
    client: openAi,
  });

  let llmCallCount = 0;
  const originalCreate = client.createChatCompletion.bind(client);
  client.createChatCompletion = (async (...args: unknown[]) => {
    llmCallCount += 1;
    options.onLlmCall?.();
    return originalCreate(
      ...(args as Parameters<CustomOpenAIClient["createChatCompletion"]>),
    );
  }) as unknown as CustomOpenAIClient["createChatCompletion"];

  const counting = client as CountingLlmClient;
  counting.consumeLlmCallCount = () => {
    const n = llmCallCount;
    llmCallCount = 0;
    return n;
  };
  return counting;
}

export type ResearchStagehandHandle = {
  stagehand: Stagehand;
  consumeLlmCallCount: () => number;
};

/**
 * Stagehand on Browserbase with OpenRouter (OpenAI-compatible chat endpoint).
 * Uses AI_MODEL (default openrouter/free) — same stack as Extract / Generate.
 */
export async function createResearchStagehand(
  options: CreateResearchStagehandOptions,
): Promise<ResearchStagehandHandle> {
  const { apiKey, projectId } = getBrowserbaseCredentials();
  const llmClient = buildResearchStagehandLlmClient({
    openRouterApiKey: options.openRouterApiKey,
    onLlmCall: options.onLlmCall,
  });

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey,
    projectId,
    browserbaseSessionID: options.sessionId,
    llmClient,
    disablePino: true,
    verbose: 0,
    logger: quietStagehandLogger,
  });

  await stagehand.init();
  return {
    stagehand,
    consumeLlmCallCount: () => llmClient.consumeLlmCallCount(),
  };
}
