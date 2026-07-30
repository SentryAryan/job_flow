import { describe, expect, it, vi } from "vitest";

import {
    detectAdzunaCountry,
    formatAdzunaSalary,
    searchAdzunaJobs,
} from "@/lib/adzuna";

describe("detectAdzunaCountry", () => {
  it("defaults to us for empty location", () => {
    expect(detectAdzunaCountry("")).toBe("us");
    expect(detectAdzunaCountry("   ")).toBe("us");
  });

  it("detects gb, au, ca from common place names", () => {
    expect(detectAdzunaCountry("London, UK")).toBe("gb");
    expect(detectAdzunaCountry("Sydney")).toBe("au");
    expect(detectAdzunaCountry("Toronto, Canada")).toBe("ca");
  });

  it("defaults unknown locations to us", () => {
    expect(detectAdzunaCountry("Berlin")).toBe("us");
  });
});

describe("formatAdzunaSalary", () => {
  it("formats min/max range", () => {
    expect(formatAdzunaSalary(160000, 200000)).toBe("$160k - $200k");
  });

  it("formats min-only and returns null when missing", () => {
    expect(formatAdzunaSalary(120000)).toBe("$120k+");
    expect(formatAdzunaSalary(undefined, 100000)).toBeNull();
    expect(formatAdzunaSalary(0, 100000)).toBeNull();
  });
});

describe("searchAdzunaJobs", () => {
  it("calls Adzuna without category and omits where when location empty", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        results: [
          {
            id: "1",
            title: "Engineer",
            company: { display_name: "Acme" },
            location: { display_name: "Remote" },
            description: "Build things",
            redirect_url: "https://example.com/job",
            salary_is_predicted: "1",
            created: "2026-07-01T00:00:00Z",
            category: { tag: "it-jobs", label: "IT" },
          },
        ],
      }),
    );

    const results = await searchAdzunaJobs({
      jobTitle: "Frontend Engineer",
      location: "",
      appId: "app",
      appKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(results).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalled();
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string] | undefined;
    expect(firstCall).toBeDefined();
    const calledUrl = String(firstCall![0]);
    expect(calledUrl).toContain("/jobs/us/search/1");
    expect(calledUrl).not.toContain("category=");
    expect(calledUrl).toContain("what=Frontend");
    expect(calledUrl).not.toContain("where=");
  });

  it("includes where and gb country for London", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ results: [] }));

    await searchAdzunaJobs({
      jobTitle: "Engineer",
      location: "London",
      appId: "app",
      appKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string] | undefined;
    expect(firstCall).toBeDefined();
    const calledUrl = String(firstCall![0]);
    expect(calledUrl).toContain("/jobs/gb/search/1");
    expect(calledUrl).toContain("where=London");
  });
});
