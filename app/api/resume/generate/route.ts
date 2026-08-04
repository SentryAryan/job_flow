import { createClient } from "@insforge/sdk";
import { generateObject } from "ai";
import { NextResponse } from "next/server";

import {
    isOpenRouterKeyUnusableError,
    withOpenRouterKeyFailover,
} from "@/lib/ai/provider";
import { requireAuth } from "@/lib/api-auth";
import {
    BYOK_KEYS_FAILED_USER_MESSAGE,
    loadDecryptedOpenRouterKeys,
} from "@/lib/byok-keys";
import { errorMessage, isNotFoundError } from "@/lib/errors";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import { mapRowToProfile } from "@/lib/profile";
import {
    admitResumeAiUserQuota,
    enforceResumeAiIpRateLimit,
    enforceResumeAiRateLimit,
    rateLimitResponseHeaders,
} from "@/lib/resume-ai-rate-limit";
import {
    buildGenerateUserPrompt,
    buildResumePdfModel,
    canGenerateResume,
    finalizeResumeGenerate,
    GENERATE_SYSTEM_PROMPT,
    healGenerateFromError,
    polishResumeFromProfile,
    resumeGenerateSchema,
    type PolishedResumeContent,
} from "@/lib/resume-generate";
import { renderResumePdfBuffer } from "@/lib/resume-pdf/DemoResumeDocument";
import {
    extractStorageObjectKey,
    resumeObjectKey,
} from "@/lib/storage-keys";

export const runtime = "nodejs";

const MAX_OUTPUT_TOKENS = 4096;

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

async function removeResumeKeys(
  client: ReturnType<typeof createClient>,
  keys: Iterable<string>,
): Promise<void> {
  const bucket = client.storage.from("resumes");
  for (const key of keys) {
    const { error } = await bucket.remove(key);
    if (!error) continue;
    if (isNotFoundError(error)) continue;
    console.error("[api/resume/generate] remove", key, errorMessage(error));
  }
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
    console.error("resume generate IP rate limit unavailable", error);
    return jsonError(
      503,
      "Resume generation is temporarily unavailable. Please try again later.",
    );
  }

  let client: ReturnType<typeof createClient>;
  try {
    client = createAuthedInsforgeClient(auth.accessToken);
  } catch (error) {
    console.error("[api/resume/generate] client", error);
    return jsonError(503, "Resume generation is temporarily unavailable.");
  }

  let byokKeys: string[] = [];
  try {
    byokKeys = await loadDecryptedOpenRouterKeys(auth.user.id, client);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("BYOK_ENCRYPTION_SECRET")
    ) {
      console.error("resume generate BYOK crypto unavailable", error);
      return jsonError(
        503,
        "Resume generation is temporarily unavailable. Please try again later.",
      );
    }
    console.error("resume generate BYOK load failed", error);
    return jsonError(
      503,
      "Resume generation is temporarily unavailable. Please try again later.",
    );
  }

  const useByok = byokKeys.length > 0;

  if (!useByok) {
    try {
      const admission = await admitResumeAiUserQuota(auth.user.id);
      if (!admission.admitted) {
        return jsonError(
          429,
          "Too many resume generations. Please try again later.",
          admission.headers,
        );
      }
    } catch (error) {
      console.error("resume generate rate limit unavailable", error);
      return jsonError(
        503,
        "Resume generation is temporarily unavailable. Please try again later.",
      );
    }
  }

  const { data: row, error: loadError } = await client.database
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  if (loadError || !row || typeof row !== "object") {
    console.error("[api/resume/generate] load profile", loadError);
    return jsonError(404, "Profile not found. Save your profile and try again.");
  }

  const profile = mapRowToProfile(row as Record<string, unknown>);

  if (!canGenerateResume(profile)) {
    return jsonError(
      400,
      "Add your name and at least education, skills, or work experience before generating a resume.",
    );
  }

  let polished: PolishedResumeContent;
  try {
    polished = await withOpenRouterKeyFailover(
      async (model) => {
        try {
          const result = await generateObject({
            model,
            schema: resumeGenerateSchema,
            system: GENERATE_SYSTEM_PROMPT,
            prompt: buildGenerateUserPrompt(profile),
            temperature: 0.7,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          });
          return finalizeResumeGenerate(result.object, profile);
        } catch (inner) {
          const healed = healGenerateFromError(inner, profile);
          if (healed) {
            console.warn(
              "resume generate: healed non-JSON / partial model output",
            );
            return healed;
          }
          throw inner;
        }
      },
      useByok ? { keys: byokKeys } : undefined,
    );
  } catch (error) {
    if (useByok && isOpenRouterKeyUnusableError(error)) {
      return jsonError(502, BYOK_KEYS_FAILED_USER_MESSAGE, rateLimitHeaders);
    }

    // Free models are flaky — fall back to deterministic profile polish
    // so generate still succeeds when AI is unavailable or unparseable.
    // (BYOK auth/quota failures are handled above — never fall back to platform keys.)
    console.warn(
      "[api/resume/generate] AI unavailable; using profile fallback",
      error,
    );
    polished = polishResumeFromProfile(profile);
  }

  const pdfModel = buildResumePdfModel(profile, polished);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderResumePdfBuffer(pdfModel);
  } catch (error) {
    console.error("[api/resume/generate] render", error);
    return jsonError(
      500,
      "Could not render resume PDF. Please try again.",
      rateLimitHeaders,
    );
  }

  const canonicalKey = resumeObjectKey(auth.user.id);
  const previousUrl = profile.resume_pdf_url;
  const staleKeys = new Set<string>();
  if (previousUrl) {
    const previousKey = extractStorageObjectKey(previousUrl);
    if (previousKey) staleKeys.add(previousKey);
  }

  const pdfFile = new File([new Uint8Array(pdfBuffer)], "resume.pdf", {
    type: "application/pdf",
  });

  const { data: uploadData, error: uploadError } = await client.storage
    .from("resumes")
    .upload(canonicalKey, pdfFile);

  if (uploadError || !uploadData?.url) {
    console.error("[api/resume/generate] upload", uploadError);
    return jsonError(
      502,
      "Failed to upload generated resume. Please try again.",
      rateLimitHeaders,
    );
  }

  const uploadedKey = uploadData.key ?? canonicalKey;
  staleKeys.delete(uploadedKey);
  if (staleKeys.size > 0) {
    await removeResumeKeys(client, staleKeys);
  }

  const { data: updated, error: updateError } = await client.database
    .from("profiles")
    .update({ resume_pdf_url: uploadData.url })
    .eq("id", auth.user.id)
    .select("resume_pdf_url")
    .single();

  if (updateError || !updated) {
    console.error("[api/resume/generate] update url", updateError);
    return jsonError(
      502,
      "Resume uploaded but failed to save URL. Please try again.",
      rateLimitHeaders,
    );
  }

  const resumePdfUrl =
    typeof (updated as { resume_pdf_url?: unknown }).resume_pdf_url === "string"
      ? (updated as { resume_pdf_url: string }).resume_pdf_url
      : uploadData.url;

  if (!useByok) {
    try {
      const rate = await enforceResumeAiRateLimit(auth.user.id);
      if (rate.enforced) {
        rateLimitHeaders = rateLimitResponseHeaders(rate.result);
      }
    } catch (error) {
      console.error("resume generate rate limit record failed", error);
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: { resume_pdf_url: resumePdfUrl },
    },
    { headers: rateLimitHeaders },
  );
}
