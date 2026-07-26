export type MockJobRow = {
  id: string;
  company: string;
  title: string;
  match_score: number;
  salary: string;
  found_at: string;
};

export type MatchFilter = "all" | "high" | "low";
export type SortOption = "match_score" | "newest" | "oldest";

export const FIND_JOBS_PAGE_SIZE = 6;

export const HIGH_MATCH_THRESHOLD = 70;

/** Find Jobs design: 90+ green, 80–89 blue, else orange. */
export function getMatchScoreBarClass(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-info";
  return "bg-warning";
}

export function filterJobs(
  jobs: readonly MockJobRow[],
  query: string,
  matchFilter: MatchFilter,
): MockJobRow[] {
  const normalized = query.trim().toLowerCase();

  return jobs.filter((job) => {
    if (matchFilter === "high" && job.match_score < HIGH_MATCH_THRESHOLD) {
      return false;
    }
    if (matchFilter === "low" && job.match_score >= HIGH_MATCH_THRESHOLD) {
      return false;
    }
    if (!normalized) return true;
    return (
      job.company.toLowerCase().includes(normalized) ||
      job.title.toLowerCase().includes(normalized)
    );
  });
}

export function sortJobs(
  jobs: readonly MockJobRow[],
  sort: SortOption,
): MockJobRow[] {
  const copy = [...jobs];

  switch (sort) {
    case "match_score":
      return copy.sort((a, b) => b.match_score - a.match_score);
    case "newest":
      return copy.sort(
        (a, b) =>
          new Date(b.found_at).getTime() - new Date(a.found_at).getTime(),
      );
    case "oldest":
      return copy.sort(
        (a, b) =>
          new Date(a.found_at).getTime() - new Date(b.found_at).getTime(),
      );
    default: {
      const _exhaustive: never = sort;
      throw new Error(`Unsupported sort option: ${String(_exhaustive)}`);
    }
  }
}

export type PaginatedJobs = {
  items: MockJobRow[];
  page: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

export function paginateJobs(
  jobs: readonly MockJobRow[],
  page: number,
  pageSize: number = FIND_JOBS_PAGE_SIZE,
): PaginatedJobs {
  const total = jobs.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage =
    totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = jobs.slice(start, start + pageSize);
  const from = total === 0 ? 0 : start + 1;
  const to = total === 0 ? 0 : start + items.length;

  return {
    items,
    page: safePage,
    total,
    totalPages,
    from,
    to,
  };
}

export type PaginationItem = number | "ellipsis";

/** Compact page list: e.g. [1, 2, 3, "ellipsis", 8] for page 1 of 8. */
export function getPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  pages.add(currentPage);

  for (let i = currentPage - 1; i <= currentPage + 1; i += 1) {
    if (i > 1 && i < totalPages) pages.add(i);
  }

  // Prefer showing 2 and 3 near the start when on early pages (design: 1 2 3 … 8)
  if (currentPage <= 2) {
    pages.add(2);
    pages.add(3);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: PaginationItem[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const page = sorted[i]!;
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (page - prev > 1) {
        result.push("ellipsis");
      }
    }
    result.push(page);
  }

  return result;
}

export function formatRelativeFoundAt(
  isoDate: string,
  now: Date = new Date(),
): string {
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
