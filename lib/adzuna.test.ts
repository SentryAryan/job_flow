import { describe, expect, it, vi } from "vitest";

import {
    adzunaCurrencySymbol,
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

  it("does not treat California CA suffix as Canada", () => {
    expect(detectAdzunaCountry("San Francisco, CA")).toBe("us");
    expect(detectAdzunaCountry("Los Angeles, CA")).toBe("us");
    expect(detectAdzunaCountry("Palo Alto, CA")).toBe("us");
  });

  it("still detects Canada via unambiguous terms", () => {
    expect(detectAdzunaCountry("Vancouver")).toBe("ca");
    expect(detectAdzunaCountry("Ontario")).toBe("ca");
  });

  it("defaults unknown locations to us", () => {
    expect(detectAdzunaCountry("Berlin")).toBe("us");
  });
});

describe("adzunaCurrencySymbol", () => {
  it("maps countries to display prefixes", () => {
    expect(adzunaCurrencySymbol("us")).toBe("$");
    expect(adzunaCurrencySymbol("gb")).toBe("£");
    expect(adzunaCurrencySymbol("au")).toBe("A$");
    expect(adzunaCurrencySymbol("ca")).toBe("C$");
  });
});

describe("formatAdzunaSalary", () => {
  it("formats min/max range with default $", () => {
    expect(formatAdzunaSalary(160000, 200000)).toBe("$160k - $200k");
  });

  it("formats min-only and returns null when missing", () => {
    expect(formatAdzunaSalary(120000)).toBe("$120k+");
    expect(formatAdzunaSalary(undefined, 100000)).toBeNull();
    expect(formatAdzunaSalary(0, 100000)).toBeNull();
  });

  it("uses country currency symbols", () => {
    expect(formatAdzunaSalary(80000, 100000, "£")).toBe("£80k - £100k");
    expect(formatAdzunaSalary(90000, undefined, "A$")).toBe("A$90k+");
    expect(formatAdzunaSalary(70000, 90000, "C$")).toBe("C$70k - C$90k");
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

  it("uses us endpoint for California CA suffix locations", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ results: [] }));

    await searchAdzunaJobs({
      jobTitle: "Engineer",
      location: "San Francisco, CA",
      appId: "app",
      appKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const calledUrl = String(
      (fetchImpl.mock.calls[0] as unknown as [string])[0],
    );
    expect(calledUrl).toContain("/jobs/us/search/1");
  });
});
