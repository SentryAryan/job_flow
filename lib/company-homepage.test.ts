import { describe, expect, it, vi } from "vitest";

import {
    deriveCompanyHomepage,
    rootDomainFromHostname,
    slugifyCompanyForDomain,
} from "@/lib/company-homepage";

describe("rootDomainFromHostname", () => {
  it("strips www and jobs subdomain", () => {
    expect(rootDomainFromHostname("jobs.stripe.com")).toBe("stripe.com");
    expect(rootDomainFromHostname("www.stripe.com")).toBe("stripe.com");
    expect(rootDomainFromHostname("stripe.com")).toBe("stripe.com");
  });

  it("keeps two-part public suffixes reasonably", () => {
    expect(rootDomainFromHostname("careers.example.co.uk")).toBe("example.co.uk");
  });
});

describe("slugifyCompanyForDomain", () => {
  it("slugifies company names", () => {
    expect(slugifyCompanyForDomain("Acme Corp")).toBe("acme");
    expect(slugifyCompanyForDomain("Stripe, Inc.")).toBe("stripe");
    expect(slugifyCompanyForDomain("  Foo   Bar  ")).toBe("foo");
  });

  it("returns empty for unusable names", () => {
    expect(slugifyCompanyForDomain("!!!")).toBe("");
    expect(slugifyCompanyForDomain(null)).toBe("");
  });
});

describe("deriveCompanyHomepage", () => {
  it("follows redirects and builds https homepage from root domain", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://jobs.stripe.com/role/123",
    }));

    const result = await deriveCompanyHomepage({
      redirectUrl: "https://www.adzuna.com/details/1",
      companyName: "Stripe",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://www.adzuna.com/details/1",
      expect.objectContaining({
        redirect: "follow",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual({
      homepageUrl: "https://stripe.com",
      resolvedJobPageUrl: "https://jobs.stripe.com/role/123",
      source: "redirect",
    });
  });

  it("falls back to company slug when still on adzuna after follow", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://www.adzuna.com/land/ad/xyz",
    }));

    const result = await deriveCompanyHomepage({
      redirectUrl: "https://www.adzuna.com/details/1",
      companyName: "Acme Labs",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      homepageUrl: "https://www.acme.com",
      resolvedJobPageUrl: null,
      source: "company_fallback",
    });
  });

  it("falls back when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await deriveCompanyHomepage({
      redirectUrl: "https://example.com/job",
      companyName: "Globex Inc",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.homepageUrl).toBe("https://www.globex.com");
    expect(result.source).toBe("company_fallback");
  });

  it("falls back when redirect URL missing", async () => {
    const result = await deriveCompanyHomepage({
      redirectUrl: null,
      companyName: "Initech",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    expect(result).toEqual({
      homepageUrl: "https://www.initech.com",
      resolvedJobPageUrl: null,
      source: "company_fallback",
    });
  });

  it("maps known retail storefronts to corporate about sites", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://www.amazon.com/jobs/123",
    }));

    const result = await deriveCompanyHomepage({
      redirectUrl: "https://www.adzuna.com/details/1",
      companyName: "Amazon",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      homepageUrl: "https://www.aboutamazon.com",
      resolvedJobPageUrl: "https://www.amazon.com/jobs/123",
      source: "storefront_override",
    });
  });

  it("maps Amazon to aboutamazon when redirect is missing (name fallback)", async () => {
    const result = await deriveCompanyHomepage({
      redirectUrl: null,
      companyName: "Amazon",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    expect(result).toEqual({
      homepageUrl: "https://www.aboutamazon.com",
      resolvedJobPageUrl: null,
      source: "storefront_override",
    });
  });
});
