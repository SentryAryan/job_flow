import { authedFetch } from "@/lib/authed-fetch";

export type FindJobsResultData = {
  jobsFound: number;
  strongMatches: number;
  runId: string;
  message: string;
  matchScores: number[];
};

export type FindJobsApiResult =
  | { success: true; data: FindJobsResultData }
  | { success: false; error: string; status?: number };

/**
 * Trigger Adzuna discovery + scoring via POST /api/agent/find.
 */
export async function findJobs(
  jobTitle: string,
  location: string,
): Promise<FindJobsApiResult> {
  try {
    const response = await authedFetch("/api/agent/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle, location }),
    });

    const payload = (await response.json()) as {
      success?: boolean;
      data?: FindJobsResultData;
      error?: string | null;
    };

    if (!response.ok || !payload.success || !payload.data) {
      return {
        success: false,
        status: response.status,
        error:
          payload.error ??
          "Could not complete job search. Please try again.",
      };
    }

    return { success: true, data: payload.data };
  } catch {
    return {
      success: false,
      error: "Could not complete job search. Please try again.",
    };
  }
}
