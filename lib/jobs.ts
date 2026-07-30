import { authedFetch } from "@/lib/authed-fetch";
import type {
    JobListRow,
    MatchFilter,
    PageSizeOption,
    SortOption,
} from "@/lib/find-jobs-list";

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
