import { generateObject, NoObjectGeneratedError } from "ai";
import { NextResponse } from "next/server";

import { isOpenRouterKeyUnusableError, withOpenRouterKeyFailover } from "@/lib/ai/provider";
import { requireAuth } from "@/lib/api-auth";
import {
    BYOK_KEYS_FAILED_USER_MESSAGE,
    loadDecryptedOpenRouterKeys,
} from "@/lib/byok-keys";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import { extractPdfContent, isPdfMagicBytes } from "@/lib/pdf-text";
import {
    admitResumeAiUserQuota,
    enforceResumeAiIpRateLimit,
    enforceResumeAiRateLimit,
    rateLimitResponseHeaders,
} from "@/lib/resume-ai-rate-limit";
import {
    EMPTY_RESUME_TEXT_ERROR,
    EXTRACT_SYSTEM_PROMPT,
    finalizeExtract,
    hasHeuristicExtractFields,
    hasSubstantiveExtractFields,
    isResumeTextTooShort,
    parseExtractFromModelText,
    profileExtractSchema,
    type ProfileExtract,
} from "@/lib/resume-extract";

export const runtime = "nodejs";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
/** Free reasoning models spend many tokens on thinking; keep headroom for JSON. */
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

function healFromError(
  error: unknown,
  resumeText: string,
): ProfileExtract | null {
  if (!NoObjectGeneratedError.isInstance(error)) return null;

  const text = typeof error.text === "string" ? error.text : "";
  const fromText = parseExtractFromModelText(text, resumeText);
  if (fromText) return fromText;

  const cause = error.cause as { value?: unknown } | undefined;
  if (cause?.value != null) {
    return finalizeExtract(cause.value, resumeText);
  }

  return null;
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
    console.error("resume extract IP rate limit unavailable", error);
    return jsonError(
      503,
      "Resume extraction is temporarily unavailable. Please try again later.",
    );
  }

  let byokKeys: string[] = [];
  try {
    const client = createAuthedInsforgeClient(accessToken);
    byokKeys = await loadDecryptedOpenRouterKeys(user.id, client);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("BYOK_ENCRYPTION_SECRET")
    ) {
      console.error("resume extract BYOK crypto unavailable", error);
      return jsonError(
        503,
        "Resume extraction is temporarily unavailable. Please try again later.",
      );
    }
    console.error("resume extract BYOK load failed", error);
    return jsonError(
      503,
      "Resume extraction is temporarily unavailable. Please try again later.",
    );
  }

  const useByok = byokKeys.length > 0;

  if (!useByok) {
    try {
      const admission = await admitResumeAiUserQuota(user.id);
      if (!admission.admitted) {
        return jsonError(
          429,
          "Too many resume extractions. Please try again later.",
          admission.headers,
        );
      }
    } catch (error) {
      console.error("resume extract rate limit unavailable", error);
      return jsonError(
        503,
        "Resume extraction is temporarily unavailable. Please try again later.",
      );
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Invalid form data");
  }

  const file = formData.get("resume");
  if (!(file instanceof File)) {
    return jsonError(400, "Resume PDF is required");
  }

  if (file.type && file.type !== "application/pdf") {
    return jsonError(400, "Only PDF resumes are supported");
  }

  if (file.size > MAX_RESUME_BYTES) {
    return jsonError(400, "Resume must be 5MB or smaller");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!isPdfMagicBytes(buffer)) {
    return jsonError(400, "Only PDF resumes are supported");
  }

  let text: string;
  try {
    const pdf = await extractPdfContent(buffer);
    text = pdf.text;
  } catch (error) {
    console.error("pdf-parse failed", error);
    return jsonError(400, EMPTY_RESUME_TEXT_ERROR);
  }

  if (isResumeTextTooShort(text)) {
    return jsonError(400, EMPTY_RESUME_TEXT_ERROR);
  }

  const resumeText = text.slice(0, 16000);

  async function recordSuccessUsage(): Promise<HeadersInit | undefined> {
    if (useByok) return rateLimitHeaders;
    try {
      const rate = await enforceResumeAiRateLimit(user.id);
      if (rate.enforced) {
        return rateLimitResponseHeaders(rate.result);
      }
    } catch (error) {
      console.error("resume extract rate limit record failed", error);
    }
    return rateLimitHeaders;
  }

  try {
    const { object } = await withOpenRouterKeyFailover(
      (model) =>
        generateObject({
          model,
          schema: profileExtractSchema,
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          system: EXTRACT_SYSTEM_PROMPT,
          prompt: `Extract a complete profile JSON from this resume.
Remember:
- education.degree must be exactly one of: High School, Associate, Bachelor, Master, PhD, Bootcamp, Other
- work_experience dates must be YYYY-MM; responsibilities must be a single string
- education.field_of_study must be separate from degree
- Fill linkedin_url and portfolio_url from EXTRACTED_HYPERLINKS / markdown links even when only labels like "LinkedIn" or "GitHub" appear
- Infer salary_expectation from experience and skills

Resume text:

${resumeText}`,
        }),
      useByok ? { keys: byokKeys } : undefined,
    );

    const data = finalizeExtract(object, resumeText);
    if (!hasSubstantiveExtractFields(data)) {
      return jsonError(
        502,
        "Could not extract profile from this resume. Please try again.",
      );
    }
    const headers = await recordSuccessUsage();
    return NextResponse.json({ success: true, data }, { headers });
  } catch (error) {
    if (useByok && isOpenRouterKeyUnusableError(error)) {
      return jsonError(502, BYOK_KEYS_FAILED_USER_MESSAGE);
    }

    const healed = healFromError(error, resumeText);
    if (healed && hasSubstantiveExtractFields(healed)) {
      console.warn(
        "resume extract: healed partial model output after schema mismatch",
      );
      const headers = await recordSuccessUsage();
      return NextResponse.json(
        { success: true, data: healed },
        { headers },
      );
    }

    // Heuristic-only when model failed entirely — require stronger signal than salary.
    const fallbackOnly = finalizeExtract({}, resumeText);
    if (hasHeuristicExtractFields(fallbackOnly)) {
      console.warn("resume extract: returning heuristic-only fallback");
      const headers = await recordSuccessUsage();
      return NextResponse.json(
        {
          success: true,
          data: fallbackOnly,
          partial: true,
        },
        { headers },
      );
    }

    console.error("resume extract AI failed", error);
    return jsonError(
      502,
      useByok
        ? BYOK_KEYS_FAILED_USER_MESSAGE
        : "Could not extract profile from this resume. Please try again.",
    );
  }
}
