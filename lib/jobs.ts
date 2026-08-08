import { authedFetch } from "@/lib/authed-fetch";
import type {
    JobListRow,
    MatchFilter,
    PageSizeOption,
    SortOption,
} from "@/lib/find-jobs-list";
import { researchClientAbortTimeoutMs } from "@/lib/research-timeouts";
import type { Job } from "@/types";

export type JobsPageData = {
  items: JobListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

export type FetchJobsPageParams = {
  page: number;
  pageSize: PageSizeOption;
  q?: string;
  match?: MatchFilter;
  sort?: SortOption;
};

export type FetchJobsPageResult =
  | { success: true; data: JobsPageData }
  | { success: false; error: string };

/**
 * Client fetch for GET /api/jobs (Bearer JWT via authedFetch).
 */
export async function fetchJobsPage(
  params: FetchJobsPageParams,
): Promise<FetchJobsPageResult> {
  try {
    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
      match: params.match ?? "all",
      sort: params.sort ?? "match_score",
    });
    const q = params.q?.trim() ?? "";
    if (q) query.set("q", q);

    const response = await authedFetch(`/api/jobs?${query}`, {
      method: "GET",
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      success?: boolean;
      data?: JobsPageData;
      error?: string | null;
    };

    if (!response.ok || !payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "Could not load jobs. Please try again.",
      };
    }

    return { success: true, data: payload.data };
  } catch {
    return {
      success: false,
      error: "Could not load jobs. Please try again.",
    };
  }
}

export type FetchJobByIdResult =
  | { success: true; data: Job }
  | { success: false; error: string; status?: number };

/**
 * Client fetch for GET /api/jobs/[id] (Bearer JWT via authedFetch).
 */
export async function fetchJobById(id: string): Promise<FetchJobByIdResult> {
  const trimmed = id.trim();
  if (!trimmed) {
    return { success: false, error: "Job id is required.", status: 400 };
  }

  try {
    const response = await authedFetch(
      `/api/jobs/${encodeURIComponent(trimmed)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as {
      success?: boolean;
      data?: Job;
      error?: string | null;
    };

    if (response.status === 404) {
      return {
        success: false,
        error: payload.error ?? "Job not found.",
        status: 404,
      };
    }

    if (!response.ok || !payload.success || !payload.data) {
      return {
        success: false,
        error: payload.error ?? "Could not load job. Please try again.",
        status: response.status,
      };
    }

    return { success: true, data: payload.data };
  } catch {
    return {
      success: false,
      error: "Could not load job. Please try again.",
    };
  }
}

export type ResearchCompanyResult =
  | {
      success: true;
      data: {
        research: NonNullable<Job["company_research"]>;
        homepageUrl: string;
        browsed: boolean;
        degraded: boolean;
      };
    }
  | { success: false; error: string; status?: number };

/**
 * Client fetch for POST /api/agent/research (Bearer JWT via authedFetch).
 * AbortSignal is longer than the server overall budget so the UI stops if the proxy hangs.
 */
export async function researchCompanyForJob(
  jobId: string,
): Promise<ResearchCompanyResult> {
  try {
    const response = await authedFetch("/api/agent/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
      signal: AbortSignal.timeout(researchClientAbortTimeoutMs()),
    });

    const payload = (await response.json()) as {
      success?: boolean;
      data?: {
        research: NonNullable<Job["company_research"]>;
        homepageUrl: string;
        browsed: boolean;
        degraded?: boolean;
      };
      error?: string | null;
    };

    if (!response.ok || !payload.success || !payload.data?.research) {
      return {
        success: false,
        error:
          payload.error ?? "Could not research this company. Please try again.",
        status: response.status,
      };
    }

    return {
      success: true,
      data: {
        research: payload.data.research,
        homepageUrl: payload.data.homepageUrl,
        browsed: payload.data.browsed,
        degraded: Boolean(payload.data.degraded),
      },
    };
  } catch {
    return {
      success: false,
      error: "Could not research this company. Please try again.",
    };
  }
}

/** Notify Navbar usage panel to refetch (dispatched after AI actions). */
export const RESUME_AI_USAGE_REFRESH_EVENT = "jobflow:resume-ai-usage-refresh";

export function notifyResumeAiUsageRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RESUME_AI_USAGE_REFRESH_EVENT));
}
