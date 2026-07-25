import { generateObject, NoObjectGeneratedError } from "ai";
import { NextResponse } from "next/server";

import { withOpenRouterKeyFailover } from "@/lib/ai/provider";
import { requireAuth } from "@/lib/api-auth";
import { extractPdfContent, isPdfMagicBytes } from "@/lib/pdf-text";
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
import {
    enforceResumeExtractRateLimit,
    rateLimitResponseHeaders,
} from "@/lib/resume-extract-rate-limit";

export const runtime = "nodejs";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
/** Free reasoning models spend many tokens on thinking; keep headroom for JSON. */
const MAX_OUTPUT_TOKENS = 4096;

function jsonError(
  status: number,
  error: string,
  headers?: HeadersInit,
) {
  return NextResponse.json({ success: false, error }, { status, headers });
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

  let rateLimitHeaders: HeadersInit | undefined;
  try {
    const rate = await enforceResumeExtractRateLimit(auth.user.id);
    if (rate.enforced) {
      rateLimitHeaders = rateLimitResponseHeaders(rate.result);
      if (!rate.result.allowed) {
        return jsonError(
          429,
          "Too many resume extractions. Please try again later.",
          rateLimitHeaders,
        );
      }
    }
  } catch (error) {
    console.error("resume extract rate limit unavailable", error);
    return jsonError(
      503,
      "Resume extraction is temporarily unavailable. Please try again later.",
    );
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

  try {
    const { object } = await withOpenRouterKeyFailover((model) =>
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
    );

    const data = finalizeExtract(object, resumeText);
    if (!hasSubstantiveExtractFields(data)) {
      return jsonError(
        502,
        "Could not extract profile from this resume. Please try again.",
      );
    }
    return NextResponse.json(
      { success: true, data },
      { headers: rateLimitHeaders },
    );
  } catch (error) {
    const healed = healFromError(error, resumeText);
    if (healed && hasSubstantiveExtractFields(healed)) {
      console.warn(
        "resume extract: healed partial model output after schema mismatch",
      );
      return NextResponse.json(
        { success: true, data: healed },
        { headers: rateLimitHeaders },
      );
    }

    // Heuristic-only when model failed entirely — require stronger signal than salary.
    const fallbackOnly = finalizeExtract({}, resumeText);
    if (hasHeuristicExtractFields(fallbackOnly)) {
      console.warn("resume extract: returning heuristic-only fallback");
      return NextResponse.json(
        {
          success: true,
          data: fallbackOnly,
          partial: true,
        },
        { headers: rateLimitHeaders },
      );
    }

    console.error("resume extract AI failed", error);
    return jsonError(
      502,
      "Could not extract profile from this resume. Please try again.",
    );
  }
}
