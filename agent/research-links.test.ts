import { describe, expect, it } from "vitest";

import {
    fallbackCompanyPageUrls,
    isNavigableHttpUrl,
    normalizeResearchPageLinks,
    resolveSubPageTargets,
} from "@/agent/research-links";

describe("isNavigableHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isNavigableHttpUrl("https://mthree.com/about")).toBe(true);
    expect(isNavigableHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects Stagehand element IDs and non-http schemes", () => {
    expect(isNavigableHttpUrl("3-994")).toBe(false);
    expect(isNavigableHttpUrl("javascript:void(0)")).toBe(false);
    expect(isNavigableHttpUrl("")).toBe(false);
  });
});

describe("normalizeResearchPageLinks", () => {
  it("drops element IDs and keeps absolute https links", () => {
    const normalized = normalizeResearchPageLinks(
      [
        { url: "3-994", kind: "about" },
        { url: "https://mthree.com/about", kind: "about" },
        { url: "https://mthree.com/careers", kind: "careers" },
      ],
      "https://mthree.com",
    );
    expect(normalized.map((l) => l.url)).toEqual([
      "https://mthree.com/about",
      "https://mthree.com/careers",
    ]);
  });

  it("resolves relative paths against homepage origin", () => {
    const normalized = normalizeResearchPageLinks(
      [{ url: "/about", kind: "about" }],
      "https://mthree.com/home",
    );
    expect(normalized).toEqual([
      { url: "https://mthree.com/about", kind: "about" },
    ]);
  });

  it("drops login / shop / cart denylist URLs", () => {
    const normalized = normalizeResearchPageLinks(
      [
        { url: "https://made.com/secure/accounts/transfer", kind: "other" },
        { url: "https://made.com/cart", kind: "other" },
        { url: "https://made.com/about", kind: "about" },
      ],
      "https://made.com",
    );
    expect(normalized.map((l) => l.url)).toEqual(["https://made.com/about"]);
  });
});

describe("fallbackCompanyPageUrls", () => {
  it("builds absolute same-origin fallbacks up to max", () => {
    const urls = fallbackCompanyPageUrls("https://mthree.com/", 1);
    expect(urls.map((l) => l.url)).toEqual(["https://mthree.com/about"]);
  });
});

describe("resolveSubPageTargets", () => {
  it("falls back when all links are invalid IDs", () => {
    const targets = resolveSubPageTargets(
      [
        { url: "3-994", kind: "about" },
        { url: "3-941", kind: "careers" },
      ],
      "https://mthree.com",
      1,
    );
    expect(targets.every((t) => t.url.startsWith("https://mthree.com/"))).toBe(
      true,
    );
    expect(targets.length).toBe(1);
  });
});
