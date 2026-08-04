import { createClient } from "@insforge/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { discoverJobs } from "@/agent/adzuna";
import { isOpenRouterKeyUnusableError } from "@/lib/ai/provider";
import { requireAuth } from "@/lib/api-auth";
import {
    BYOK_KEYS_FAILED_USER_MESSAGE,
    loadDecryptedOpenRouterKeys,
} from "@/lib/byok-keys";
import { HIGH_MATCH_THRESHOLD } from "@/lib/find-jobs-list";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import { mapRowToProfile } from "@/lib/profile";
import {
    canUseResumeAiQuota,
    enforceResumeAiIpRateLimit,
    enforceResumeAiRateLimit,
    rateLimitHeadersFromUsage,
    rateLimitResponseHeaders,
} from "@/lib/resume-ai-rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  jobTitle: z.string().trim().min(1, "Job title is required").max(200),
  location: z.string().trim().max(200).optional().default(""),
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

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

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
    console.error("agent find IP rate limit unavailable", error);
    return jsonError(
      503,
      "Job search is temporarily unavailable. Please try again later.",
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
    client = createAuthedInsforgeClient(auth.accessToken);
  } catch (error) {
    console.error("[api/agent/find] client", error);
    return jsonError(503, "Job search is temporarily unavailable.");
  }

  const { data: row, error: loadError } = await client.database
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  if (loadError || !row || typeof row !== "object") {
    console.error("[api/agent/find] load profile", loadError);
    return jsonError(
      404,
      "Profile not found. Save your profile and try again.",
    );
  }

  const profile = mapRowToProfile(row as Record<string, unknown>);

  let byokKeys: string[] = [];
  try {
    byokKeys = await loadDecryptedOpenRouterKeys(auth.user.id, client);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("BYOK_ENCRYPTION_SECRET")
    ) {
      console.error("agent find BYOK crypto unavailable", error);
      return jsonError(
        503,
        "Job search is temporarily unavailable. Please try again later.",
      );
    }
    console.error("agent find BYOK load failed", error);
    return jsonError(
      503,
      "Job search is temporarily unavailable. Please try again later.",
    );
  }

  const useByok = byokKeys.length > 0;
  /** Once AI quota is exhausted mid-search, remaining batches use skill-overlap only. */
  let aiQuotaExhausted = false;

  // Shared pool with Extract + Generate (`resume-ai:{userId}`).
  // Admission peeks (no hit). Each successful AI scoring batch records one hit.
  if (!useByok) {
    try {
      const admission = await canUseResumeAiQuota(auth.user.id);
      if (admission.checked && !admission.allowed) {
        rateLimitHeaders = rateLimitHeadersFromUsage(admission.windows);
        return jsonError(
          429,
          "Too many AI requests. Please try again later.",
          rateLimitHeaders,
        );
      }
    } catch (error) {
      console.error("agent find rate limit unavailable", error);
      return jsonError(
        503,
        "Job search is temporarily unavailable. Please try again later.",
      );
    }
  }

  try {
    const result = await discoverJobs({
      userId: auth.user.id,
      jobTitle: parsed.data.jobTitle,
      location: parsed.data.location,
      profile,
      client,
      strongMatchThreshold: HIGH_MATCH_THRESHOLD,
      openRouter: useByok ? { keys: byokKeys } : undefined,
      scoreRateLimit: useByok
        ? undefined
        : {
            canUseAi: async () => {
              if (aiQuotaExhausted) return false;
              try {
                const quota = await canUseResumeAiQuota(auth.user.id);
                if (quota.checked && !quota.allowed) {
                  aiQuotaExhausted = true;
                  rateLimitHeaders = rateLimitHeadersFromUsage(quota.windows);
                  return false;
                }
                return true;
              } catch (error) {
                console.error("agent find rate limit peek failed", error);
                throw error;
              }
            },
            onSuccessfulAiBatch: async () => {
              const rate = await enforceResumeAiRateLimit(auth.user.id);
              if (rate.enforced) {
                rateLimitHeaders = rateLimitResponseHeaders(rate.result);
                if (!rate.result.allowed) {
                  aiQuotaExhausted = true;
                }
              }
            },
          },
    });

    if (!result.success) {
      return jsonError(502, result.error, rateLimitHeaders);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          jobsFound: result.jobsFound,
          strongMatches: result.strongMatches,
          runId: result.runId,
          message: result.message,
          matchScores: result.matchScores,
        },
      },
      { headers: rateLimitHeaders },
    );
  } catch (error) {
    if (useByok && isOpenRouterKeyUnusableError(error)) {
      return jsonError(502, BYOK_KEYS_FAILED_USER_MESSAGE, rateLimitHeaders);
    }
    console.error("[api/agent/find]", error);
    return jsonError(
      500,
      "Could not complete job search. Please try again.",
      rateLimitHeaders,
    );
  }
}
