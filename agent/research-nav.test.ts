import { describe, expect, it } from "vitest";

import {
    isChromeNavigationErrorPage,
    isResearchDenylistUrl,
    isUnusableResearchPage,
    readPageNavSignals,
} from "@/agent/research-nav";

describe("isChromeNavigationErrorPage", () => {
  it("detects chrome-error URLs", () => {
    expect(
      isChromeNavigationErrorPage({
        url: "chrome-error://chromewebdata/",
        title: "Error",
        bodyText: "",
      }),
    ).toBe(true);
  });

  it("detects SSL unrecognized name interstitial", () => {
    expect(
      isChromeNavigationErrorPage({
        url: "https://www.ableforce.com/",
        title: "This site can’t be reached",
        bodyText:
          "The webpage at https://www.ableforce.com/ might be temporarily down. ERR_SSL_UNRECOGNIZED_NAME_ALERT",
      }),
    ).toBe(true);
  });

  it("detects DNS / connection errors", () => {
    expect(
      isChromeNavigationErrorPage({
        url: "https://example.invalid/",
        title: "Not found",
        bodyText: "ERR_NAME_NOT_RESOLVED",
      }),
    ).toBe(true);
  });

  it("allows a normal company homepage", () => {
    expect(
      isChromeNavigationErrorPage({
        url: "https://stripe.com/",
        title: "Stripe | Financial Infrastructure",
        bodyText: "Payments, billing, and banking-as-a-service for software.",
      }),
    ).toBe(false);
  });
});

describe("isResearchDenylistUrl", () => {
  it("flags login / account / cart paths", () => {
    expect(
      isResearchDenylistUrl("https://made.com/secure/accounts/transfer"),
    ).toBe(true);
    expect(isResearchDenylistUrl("https://shop.example/cart")).toBe(true);
    expect(isResearchDenylistUrl("https://example.com/login")).toBe(true);
    expect(isResearchDenylistUrl("https://example.com/checkout/pay")).toBe(
      true,
    );
  });

  it("allows about / careers paths", () => {
    expect(isResearchDenylistUrl("https://stripe.com/about")).toBe(false);
    expect(isResearchDenylistUrl("https://stripe.com/careers")).toBe(false);
  });
});

describe("isUnusableResearchPage", () => {
  it("detects Access Denied / Akamai", () => {
    expect(
      isUnusableResearchPage({
        url: "https://www.made.com/about",
        title: "Access Denied",
        bodyText: "You don't have permission to access this page.",
      }),
    ).toBe(true);
  });

  it("detects dedicated Sign In / Register via title (not denylist URL)", () => {
    expect(
      isUnusableResearchPage({
        url: "https://www.made.com/customer/auth",
        title: "Sign In / Register",
        bodyText: "Create an account or log in to continue.",
      }),
    ).toBe(true);
  });

  it("detects denylist account URLs even with Sign In title", () => {
    expect(
      isUnusableResearchPage({
        url: "https://www.made.com/secure/accounts/transfer",
        title: "Sign In / Register",
        bodyText: "Create an account or log in to continue.",
      }),
    ).toBe(true);
  });

  it("flags denylist URLs even with normal titles", () => {
    expect(
      isUnusableResearchPage({
        url: "https://shop.example/cart",
        title: "Your bag",
        bodyText: "Items in your cart",
      }),
    ).toBe(true);
  });

  it("allows retailer homepages that only mention Sign in in nav chrome", () => {
    expect(
      isUnusableResearchPage({
        url: "https://www.amazon.com/",
        title: "Amazon.com. Spend less. Smile more.",
        bodyText:
          "Hello, sign in Account & Lists Returns & Orders Cart\n" +
          "Deliver to New York 10001\n" +
          "Shop deals Electronics Books Fashion\n" +
          "Create an account to save your wishlist Register for Prime",
      }),
    ).toBe(false);
  });

  it("allows a normal About page", () => {
    expect(
      isUnusableResearchPage({
        url: "https://stripe.com/about",
        title: "About Stripe",
        bodyText: "We build financial infrastructure for the internet.",
      }),
    ).toBe(false);
  });
});

describe("readPageNavSignals", () => {
  it("reads url, title, and body text when available", async () => {
    const signals = await readPageNavSignals({
      url: () => "https://stripe.com/",
      title: async () => "Stripe",
      evaluate: async () => "Payments for platforms",
    });
    expect(signals).toEqual({
      url: "https://stripe.com/",
      title: "Stripe",
      bodyText: "Payments for platforms",
    });
  });

  it("returns nulls when page methods throw", async () => {
    const signals = await readPageNavSignals({
      url: () => {
        throw new Error("closed");
      },
      title: async () => {
        throw new Error("closed");
      },
      evaluate: async () => {
        throw new Error("closed");
      },
    });
    expect(signals).toEqual({ url: null, title: null, bodyText: null });
  });
});
