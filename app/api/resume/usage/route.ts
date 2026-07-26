import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { userHasByokKeys } from "@/lib/byok-keys";
import { createAuthedInsforgeClient } from "@/lib/insforge-server";
import { peekResumeAiUsage } from "@/lib/resume-ai-rate-limit";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Read-only shared Extract + Generate usage for the authenticated user.
 * Does not record a rate-limit hit.
 * Hidden (`available: false`) in development or when the user has BYOK keys.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.success) {
    return jsonError(auth.status, auth.error);
  }

  try {
    let hasByokKeys = false;
    try {
      const client = createAuthedInsforgeClient(auth.accessToken);
      hasByokKeys = await userHasByokKeys(auth.user.id, client);
    } catch (error) {
      // Missing encryption secret / DB blip: still serve usage if possible.
      console.warn("[api/resume/usage] BYOK check failed", error);
    }

    const data = await peekResumeAiUsage(auth.user.id, undefined, {
      hasByokKeys,
    });
    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    console.error("resume AI usage peek failed", error);
    return jsonError(
      503,
      "Resume AI usage is temporarily unavailable. Please try again later.",
    );
  }
}
