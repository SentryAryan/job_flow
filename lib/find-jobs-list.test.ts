import { describe, expect, it } from "vitest";

import {
    FIND_JOBS_PAGE_SIZE,
    filterJobs,
    formatRelativeFoundAt,
    getMatchScoreBarClass,
    getPaginationItems,
    paginateJobs,
    sortJobs,
    type MatchFilter,
    type MockJobRow,
    type SortOption,
} from "@/lib/find-jobs-list";

const sampleJobs: MockJobRow[] = [
  {
    id: "1",
    company: "Vercel",
    title: "Senior Frontend Engineer",
    match_score: 94,
    salary: "$160k - $200k",
    found_at: "2026-07-26T12:00:00.000Z",
  },
  {
    id: "2",
    company: "Stripe",
    title: "Frontend Engineer",
    match_score: 65,
    salary: "$150k - $180k",
    found_at: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "3",
    company: "Linear",
    title: "Product Designer",
    match_score: 85,
    salary: "$140k - $170k",
    found_at: "2026-07-24T12:00:00.000Z",
  },
  {
    id: "4",
    company: "Notion",
    title: "React Developer",
    match_score: 50,
    salary: "$130k - $160k",
    found_at: "2026-07-23T12:00:00.000Z",
  },
];

describe("getMatchScoreBarClass", () => {
  it("returns success for scores >= 90", () => {
    expect(getMatchScoreBarClass(90)).toBe("bg-success");
    expect(getMatchScoreBarClass(94)).toBe("bg-success");
  });

  it("returns info for scores 80-89", () => {
    expect(getMatchScoreBarClass(80)).toBe("bg-info");
    expect(getMatchScoreBarClass(87)).toBe("bg-info");
  });

  it("returns warning for scores below 80", () => {
    expect(getMatchScoreBarClass(79)).toBe("bg-warning");
    expect(getMatchScoreBarClass(78)).toBe("bg-warning");
  });
});

describe("filterJobs", () => {
  it("returns all jobs for all match filter with empty query", () => {
    expect(filterJobs(sampleJobs, "", "all")).toHaveLength(4);
  });

  it("filters high match (>= 70)", () => {
    const result = filterJobs(sampleJobs, "", "high");
    expect(result.map((j) => j.id)).toEqual(["1", "3"]);
  });

  it("filters low match (< 70)", () => {
    const result = filterJobs(sampleJobs, "", "low");
    expect(result.map((j) => j.id)).toEqual(["2", "4"]);
  });

  it("filters by company or role case-insensitively", () => {
    expect(filterJobs(sampleJobs, "vercel", "all").map((j) => j.id)).toEqual([
      "1",
    ]);
    expect(filterJobs(sampleJobs, "REACT", "all").map((j) => j.id)).toEqual([
      "4",
    ]);
  });

  it("combines text and match filters", () => {
    expect(filterJobs(sampleJobs, "engineer", "high").map((j) => j.id)).toEqual(
      ["1"],
    );
  });
});

describe("sortJobs", () => {
  it("sorts by match score descending", () => {
    const result = sortJobs(sampleJobs, "match_score");
    expect(result.map((j) => j.match_score)).toEqual([94, 85, 65, 50]);
  });

  it("sorts by newest found_at first", () => {
    const result = sortJobs(sampleJobs, "newest");
    expect(result.map((j) => j.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("sorts by oldest found_at first", () => {
    const result = sortJobs(sampleJobs, "oldest");
    expect(result.map((j) => j.id)).toEqual(["4", "3", "2", "1"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...sampleJobs];
    sortJobs(sampleJobs, "match_score");
    expect(sampleJobs).toEqual(copy);
  });
});

describe("paginateJobs", () => {
  it("uses FIND_JOBS_PAGE_SIZE of 6", () => {
    expect(FIND_JOBS_PAGE_SIZE).toBe(6);
  });

  it("returns the correct slice and totals", () => {
    const many = Array.from({ length: 24 }, (_, i) => ({
      ...sampleJobs[0]!,
      id: String(i + 1),
    }));
    const page1 = paginateJobs(many, 1);
    expect(page1.items).toHaveLength(6);
    expect(page1.total).toBe(24);
    expect(page1.totalPages).toBe(4);
    expect(page1.from).toBe(1);
    expect(page1.to).toBe(6);
    expect(page1.items[0]!.id).toBe("1");

    const page2 = paginateJobs(many, 2);
    expect(page2.from).toBe(7);
    expect(page2.to).toBe(12);
    expect(page2.items[0]!.id).toBe("7");
  });

  it("clamps page below 1 to page 1", () => {
    const page = paginateJobs(sampleJobs, 0);
    expect(page.page).toBe(1);
  });

  it("returns empty range when there are no jobs", () => {
    const page = paginateJobs([], 1);
    expect(page.items).toEqual([]);
    expect(page.from).toBe(0);
    expect(page.to).toBe(0);
    expect(page.totalPages).toBe(0);
  });
});

describe("getPaginationItems", () => {
  it("returns contiguous pages for small totals", () => {
    expect(getPaginationItems(1, 3)).toEqual([1, 2, 3]);
  });

  it("inserts ellipsis for larger totals matching design pattern", () => {
    expect(getPaginationItems(1, 8)).toEqual([1, 2, 3, "ellipsis", 8]);
  });

  it("returns empty for zero pages", () => {
    expect(getPaginationItems(1, 0)).toEqual([]);
  });
});

describe("formatRelativeFoundAt", () => {
  it("formats hours ago", () => {
    const now = new Date("2026-07-26T14:00:00.000Z");
    expect(
      formatRelativeFoundAt("2026-07-26T12:00:00.000Z", now),
    ).toBe("2 hours ago");
  });

  it("formats yesterday", () => {
    const now = new Date("2026-07-26T14:00:00.000Z");
    expect(
      formatRelativeFoundAt("2026-07-25T10:00:00.000Z", now),
    ).toBe("Yesterday");
  });

  it("formats days ago", () => {
    const now = new Date("2026-07-26T14:00:00.000Z");
    expect(
      formatRelativeFoundAt("2026-07-23T10:00:00.000Z", now),
    ).toBe("3 days ago");
  });
});

describe("type exhaustiveness helpers", () => {
  it("accepts all MatchFilter and SortOption values", () => {
    const filters: MatchFilter[] = ["all", "high", "low"];
    const sorts: SortOption[] = ["match_score", "newest", "oldest"];
    expect(filters).toHaveLength(3);
    expect(sorts).toHaveLength(3);
  });
});
