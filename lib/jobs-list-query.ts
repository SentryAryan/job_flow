import {
    FIND_JOBS_PAGE_SIZE,
    HIGH_MATCH_THRESHOLD,
    isPageSizeOption,
    type MatchFilter,
    type SortOption,
} from "@/lib/find-jobs-list";

/**
 * Escape user search text for PostgREST `ilike` patterns and strip characters
 * that break `.or()` filter lists (commas).
 */
export function escapeIlikePattern(raw: string): string {
  return raw
    .trim()
    .replace(/,/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export type JobsListQueryPlan = {
  from: number;
  to: number;
  page: number;
  pageSize: number;
  orderColumn: "match_score" | "found_at";
  ascending: boolean;
  /** Secondary order for match_score sort (stable tie-break). */
  tieBreakFoundAtDesc: boolean;
  matchGte: number | null;
  matchLt: number | null;
  orFilter: string | null;
};

export function buildJobsListQueryPlan(options: {
  page?: number;
  pageSize?: number;
  q?: string;
  matchFilter?: MatchFilter;
  sort?: SortOption;
}): JobsListQueryPlan {
  const pageSize = isPageSizeOption(options.pageSize ?? FIND_JOBS_PAGE_SIZE)
    ? (options.pageSize ?? FIND_JOBS_PAGE_SIZE)
    : FIND_JOBS_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const matchFilter = options.matchFilter ?? "all";
  let matchGte: number | null = null;
  let matchLt: number | null = null;
  if (matchFilter === "high") {
    matchGte = HIGH_MATCH_THRESHOLD;
  } else if (matchFilter === "low") {
    matchLt = HIGH_MATCH_THRESHOLD;
  }

  const sort = options.sort ?? "match_score";
  let orderColumn: "match_score" | "found_at" = "match_score";
  let ascending = false;
  let tieBreakFoundAtDesc = false;
  if (sort === "match_score") {
    orderColumn = "match_score";
    ascending = false;
    tieBreakFoundAtDesc = true;
  } else if (sort === "newest") {
    orderColumn = "found_at";
    ascending = false;
  } else {
    orderColumn = "found_at";
    ascending = true;
  }

  const q = (options.q ?? "").trim();
  let orFilter: string | null = null;
  if (q.length > 0) {
    const escaped = escapeIlikePattern(q);
    if (escaped.length > 0) {
      orFilter = `company.ilike.%${escaped}%,title.ilike.%${escaped}%`;
    }
  }

  return {
    from,
    to,
    page,
    pageSize,
    orderColumn,
    ascending,
    tieBreakFoundAtDesc,
    matchGte,
    matchLt,
    orFilter,
  };
}

/** Same from/to/totalPages/safePage semantics as `paginateJobs`. */
export function paginateMeta(options: {
  total: number;
  page: number;
  pageSize: number;
  itemCount: number;
}): {
  page: number;
  totalPages: number;
  from: number;
  to: number;
} {
  const { total, pageSize, itemCount } = options;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage =
    totalPages === 0 ? 1 : Math.min(Math.max(1, options.page), totalPages);
  const start = (safePage - 1) * pageSize;
  const from = total === 0 ? 0 : start + 1;
  const to = total === 0 ? 0 : start + itemCount;

  return {
    page: safePage,
    totalPages,
    from,
    to,
  };
}
