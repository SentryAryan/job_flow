import { authedFetch } from "@/lib/authed-fetch";
import type { RateLimitWindowUsage } from "@/lib/rate-limit";

export type ResumeAiUsageData = {
  available: boolean;
  combined: true;
  windows: RateLimitWindowUsage[];
};

export type FetchResumeAiUsageResult =
  | { success: true; data: ResumeAiUsageData }
  | { success: false; error: string };

/**
 * Client fetch for GET /api/resume/usage (Bearer JWT via authedFetch).
 */
export async function fetchResumeAiUsage(): Promise<FetchResumeAiUsageResult> {
  try {
    const response = await authedFetch("/api/resume/usage", {
      method: "GET",
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      success?: boolean;
      data?: ResumeAiUsageData;
      error?: string | null;
    };

    if (!response.ok || !payload.success || !payload.data) {
      return {
        success: false,
        error:
          payload.error ??
          "Could not load Resume AI usage. Please try again.",
      };
    }

    return { success: true, data: payload.data };
  } catch {
    return {
      success: false,
      error: "Could not load Resume AI usage. Please try again.",
    };
  }
}

export const WINDOW_LABELS: Record<string, string> = {
  "1m": "Per minute",
  "1h": "Per hour",
  "1d": "Per day",
};
