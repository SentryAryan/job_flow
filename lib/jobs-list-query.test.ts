import { describe, expect, it } from "vitest";

import { HIGH_MATCH_THRESHOLD } from "@/lib/find-jobs-list";
import {
    buildJobsListQueryPlan,
    escapeIlikePattern,
    paginateMeta,
} from "@/lib/jobs-list-query";

describe("escapeIlikePattern", () => {
  it("escapes % and _ and backslash", () => {
    expect(escapeIlikePattern("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });

  it("strips commas that break PostgREST or()", () => {
    expect(escapeIlikePattern("foo,bar")).toBe("foobar");
  });

  it("strips parentheses that break PostgREST or() grouping", () => {
    expect(escapeIlikePattern("Stripe (UK)")).toBe("Stripe UK");
    expect(escapeIlikePattern("(Acme)")).toBe("Acme");
  });

  it("trims whitespace", () => {
    expect(escapeIlikePattern("  stripe  ")).toBe("stripe");
  });
});

describe("buildJobsListQueryPlan", () => {
  it("builds range for page 1 pageSize 20", () => {
    const plan = buildJobsListQueryPlan({ page: 1, pageSize: 20 });
    expect(plan.from).toBe(0);
    expect(plan.to).toBe(19);
    expect(plan.pageSize).toBe(20);
  });

  it("builds range for page 2 pageSize 10", () => {
    const plan = buildJobsListQueryPlan({ page: 2, pageSize: 10 });
    expect(plan.from).toBe(10);
    expect(plan.to).toBe(19);
  });

  it("applies high match gte threshold", () => {
    const plan = buildJobsListQueryPlan({ matchFilter: "high" });
    expect(plan.matchGte).toBe(HIGH_MATCH_THRESHOLD);
    expect(plan.matchLt).toBeNull();
  });

  it("applies low match lt threshold", () => {
    const plan = buildJobsListQueryPlan({ matchFilter: "low" });
    expect(plan.matchGte).toBeNull();
    expect(plan.matchLt).toBe(HIGH_MATCH_THRESHOLD);
  });

  it("builds company|title or filter for q", () => {
    const plan = buildJobsListQueryPlan({ q: "Stripe" });
    expect(plan.orFilter).toBe(
      "company.ilike.%Stripe%,title.ilike.%Stripe%",
    );
  });

  it("orders match_score desc with found_at tie-break", () => {
    const plan = buildJobsListQueryPlan({ sort: "match_score" });
    expect(plan.orderColumn).toBe("match_score");
    expect(plan.ascending).toBe(false);
    expect(plan.tieBreakFoundAtDesc).toBe(true);
  });

  it("orders newest / oldest by found_at", () => {
    expect(buildJobsListQueryPlan({ sort: "newest" })).toMatchObject({
      orderColumn: "found_at",
      ascending: false,
      tieBreakFoundAtDesc: false,
    });
    expect(buildJobsListQueryPlan({ sort: "oldest" })).toMatchObject({
      orderColumn: "found_at",
      ascending: true,
      tieBreakFoundAtDesc: false,
    });
  });
});

describe("paginateMeta", () => {
  it("returns empty from/to when total is 0", () => {
    expect(
      paginateMeta({ total: 0, page: 1, pageSize: 20, itemCount: 0 }),
    ).toEqual({ page: 1, totalPages: 0, from: 0, to: 0 });
  });

  it("clamps page past the end", () => {
    const meta = paginateMeta({
      total: 25,
      page: 99,
      pageSize: 10,
      itemCount: 5,
    });
    expect(meta.page).toBe(3);
    expect(meta.totalPages).toBe(3);
    expect(meta.from).toBe(21);
    expect(meta.to).toBe(25);
  });

  it("computes from/to for middle page", () => {
    expect(
      paginateMeta({ total: 50, page: 2, pageSize: 20, itemCount: 20 }),
    ).toEqual({ page: 2, totalPages: 3, from: 21, to: 40 });
  });
});
