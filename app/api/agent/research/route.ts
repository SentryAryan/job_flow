import { createClient } from "@insforge/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { researchCompany } from "@/agent/research";
import {
    getOpenRouterApiKeys,
    isOpenRouterKeyUnusableError,
} from "@/lib/ai/provider";
import { requireAuth } from "@/lib/api-auth";
import {
    BYOK_KEYS_FAILED_USER_MESSAGE,
    loadDecryptedOpenRouterKeys,
} from "@/lib/byok-keys";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import { ResearchLlmMeter } from "@/lib/research-llm-meter";
import {
    RESEARCH_MAX_OPENROUTER_CALLS,
    RESEARCH_USAGE_HITS,
    researchRouteMaxDurationSec,
} from "@/lib/research-timeouts";
import {
    canUseResumeAiQuota,
    enforceResumeAiIpRateLimit,
    enforceResumeAiRateLimitHitsCapped,
    minResumeAiRemaining,
    rateLimitHeadersFromUsage,
    rateLimitResponseHeaders,
} from "@/lib/resume-ai-rate-limit";

export const runtime = "nodejs";
/**
 * Vercel Hobby requires ≤300. Driven by RESEARCH_TIMEOUT_CLAMP /
 * NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP (`clamp` default → 300; `no_clamp` → 800
 * or RESEARCH_ROUTE_MAX_DURATION_SEC). Do not use no_clamp on Vercel Hobby.
 */
export const maxDuration = researchRouteMaxDurationSec();

const bodySchema = z.object({
  jobId: z.string().trim().uuid("Invalid job id"),
});

function jsonError(
  status: number,
  error: string,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { success: false, error, data: null },
    { status, headers },
  );
}

function resolveOpenRouterApiKey(byokKeys: string[]): string {
  if (byokKeys.length > 0) {
    return byokKeys[0]!;
  }
  const platform = getOpenRouterApiKeys();
  if (platform.length === 0) {
    throw new Error("OPENROUTER_API_KEYS (or OPENROUTER_API_KEY) is not configured");
  }
  return platform[0]!;
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  const { user, accessToken } = auth;

  let rateLimitHeaders: HeadersInit | undefined;
  try {
    const ipRate = await enforceResumeAiIpRateLimit(request);
    if (ipRate.enforced) {
      rateLimitHeaders = rateLimitResponseHeaders(ipRate.result);
      if (!ipRate.result.allowed) {
        return jsonError(
          429,
          "Too many requests from this network. Please try again later.",
          rateLimitHeaders,
        );
      }
    }
  } catch (error) {
    console.error("agent research IP rate limit unavailable", error);
    return jsonError(
      503,
      "Company research is temporarily unavailable. Please try again later.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return jsonError(400, message);
  }

  let client: ReturnType<typeof createClient>;
  try {
    client = createAuthedInsforgeClient(accessToken);
  } catch (error) {
    console.error("[api/agent/research] client", error);
    return jsonError(503, "Company research is temporarily unavailable.");
  }

  let byokKeys: string[] = [];
  try {
    byokKeys = await loadDecryptedOpenRouterKeys(user.id, client);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("BYOK_ENCRYPTION_SECRET")
    ) {
      console.error("agent research BYOK crypto unavailable", error);
      return jsonError(
        503,
        "Company research is temporarily unavailable. Please try again later.",
      );
    }
    console.error("agent research BYOK load failed", error);
    return jsonError(
      503,
      "Company research is temporarily unavailable. Please try again later.",
    );
  }

  const useByok = byokKeys.length > 0;

  if (!useByok) {
    try {
      const admission = await canUseResumeAiQuota(user.id);
      if (
        admission.checked &&
        (!admission.allowed ||
          minResumeAiRemaining(admission.windows) < RESEARCH_USAGE_HITS)
      ) {
        rateLimitHeaders = rateLimitHeadersFromUsage(admission.windows);
        return jsonError(
          429,
          "Too many AI requests. Please try again later.",
          rateLimitHeaders,
        );
      }
    } catch (error) {
      console.error("agent research rate limit unavailable", error);
      return jsonError(
        503,
        "Company research is temporarily unavailable. Please try again later.",
      );
    }
  }

  let openRouterApiKey: string;
  try {
    openRouterApiKey = resolveOpenRouterApiKey(byokKeys);
  } catch (error) {
    console.error("[api/agent/research] openrouter keys", error);
    return jsonError(
      503,
      "Company research is temporarily unavailable. Please try again later.",
    );
  }

  try {
    const llmMeter = new ResearchLlmMeter();

    const result = await researchCompany({
      userId: user.id,
      jobId: parsed.data.jobId,
      client,
      openRouterApiKey,
      openRouter: useByok ? { keys: byokKeys } : undefined,
      llmMeter,
      rateLimit: useByok
        ? undefined
        : {
            canUseExtraExtract: async () => {
              // Homepage when peek===0; one sub-page while peek<=2; never past ceiling.
              const peek = llmMeter.peek();
              return peek < RESEARCH_MAX_OPENROUTER_CALLS && peek <= 2;
            },
            canUseSynthesis: async () => {
              return llmMeter.peek() < RESEARCH_MAX_OPENROUTER_CALLS;
            },
            recordLlmHits: async (count: number) => {
              const rate = await enforceResumeAiRateLimitHitsCapped(
                user.id,
                count,
              );
              if (rate.enforced && rate.result) {
                rateLimitHeaders = rateLimitResponseHeaders(rate.result);
              }
            },
          },
    });

    if (!result.success) {
      const status = /not found/i.test(result.error) ? 404 : 500;
      return jsonError(status, result.error, rateLimitHeaders);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          research: result.research,
          homepageUrl: result.homepageUrl,
          browsed: result.browsed,
          degraded: result.degraded,
        },
      },
      { headers: rateLimitHeaders },
    );
  } catch (error) {
    if (useByok && isOpenRouterKeyUnusableError(error)) {
      return jsonError(502, BYOK_KEYS_FAILED_USER_MESSAGE, rateLimitHeaders);
    }
    console.error("[api/agent/research]", error);
    return jsonError(
      500,
      "Could not complete company research. Please try again.",
      rateLimitHeaders,
    );
  }
}
