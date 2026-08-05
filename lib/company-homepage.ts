import { RESEARCH_HOMEPAGE_FETCH_TIMEOUT_MS } from "@/lib/research-timeouts";

/** Common multi-part public suffixes we keep as the registrable domain. */
const MULTI_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "co.nz",
  "com.br",
  "co.jp",
]);

const CORPORATE_SUFFIXES =
  /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|sa|bv|nv)\b\.?/gi;

/**
 * Retail / marketplace roots that are poor employer-research landing pages.
 * Map to a corporate / about URL when the apply redirect resolves here.
 */
const STOREFRONT_HOMEPAGE_OVERRIDES: Record<string, string> = {
  "amazon.com": "https://www.aboutamazon.com",
  "amazon.co.uk": "https://www.aboutamazon.com",
  "amazon.de": "https://www.aboutamazon.com",
  "amazon.ca": "https://www.aboutamazon.com",
  "amazon.com.au": "https://www.aboutamazon.com",
  "amazon.fr": "https://www.aboutamazon.com",
  "amazon.in": "https://www.aboutamazon.com",
  "amazon.co.jp": "https://www.aboutamazon.com",
  "ebay.com": "https://www.ebayinc.com",
  "ebay.co.uk": "https://www.ebayinc.com",
  "walmart.com": "https://corporate.walmart.com",
  "target.com": "https://corporate.target.com",
  "bestbuy.com": "https://corporate.bestbuy.com",
};

/**
 * Reduce a hostname to an approximate registrable domain
 * (e.g. jobs.stripe.com → stripe.com).
 */
export function rootDomainFromHostname(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/^\.+/, "");
  if (!host) return "";

  const withoutWww = host.startsWith("www.") ? host.slice(4) : host;
  const parts = withoutWww.split(".").filter(Boolean);
  if (parts.length <= 2) return withoutWww;

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return lastTwo;
}

/** Corporate / about URL for known storefront domains, else null. */
export function storefrontCorporateHomepage(
  rootDomain: string,
): string | null {
  const key = rootDomain.trim().toLowerCase();
  return STOREFRONT_HOMEPAGE_OVERRIDES[key] ?? null;
}

/** First meaningful word of a company name, domain-safe. */
export function slugifyCompanyForDomain(
  companyName: string | null | undefined,
): string {
  if (!companyName) return "";
  const cleaned = companyName
    .replace(CORPORATE_SUFFIXES, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .toLowerCase();
  const first = cleaned.split(/[\s-]+/).find((part) => part.length > 1);
  return first ?? "";
}

export type DeriveHomepageResult = {
  homepageUrl: string;
  resolvedJobPageUrl: string | null;
  source: "redirect" | "company_fallback" | "storefront_override";
};

export type DeriveHomepageInput = {
  redirectUrl: string | null | undefined;
  companyName: string | null | undefined;
  fetchImpl?: typeof fetch;
  /** AbortSignal for redirect fetch (default: 20s timeout). */
  signal?: AbortSignal;
};

function companyFallbackHomepage(
  companyName: string | null | undefined,
): DeriveHomepageResult | null {
  const slug = slugifyCompanyForDomain(companyName);
  if (!slug) return null;

  const storefrontRoot = `${slug}.com`;
  const corporate = storefrontCorporateHomepage(storefrontRoot);
  if (corporate) {
    return {
      homepageUrl: corporate,
      resolvedJobPageUrl: null,
      source: "storefront_override",
    };
  }

  return {
    homepageUrl: `https://www.${slug}.com`,
    resolvedJobPageUrl: null,
    source: "company_fallback",
  };
}

/**
 * Derive a company homepage from an Adzuna/apply redirect URL.
 * Follows HTTP redirects server-side, then strips subdomains.
 * Known retail storefronts map to corporate/about sites (better for employer research).
 * Falls back to https://www.{company}.com when the URL still looks like Adzuna
 * or fetch fails.
 */
export async function deriveCompanyHomepage(
  input: DeriveHomepageInput,
): Promise<DeriveHomepageResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const fallback = companyFallbackHomepage(input.companyName) ?? {
    homepageUrl: "https://www.example.com",
    resolvedJobPageUrl: null,
    source: "company_fallback" as const,
  };

  const redirectUrl = input.redirectUrl?.trim();
  if (!redirectUrl) {
    return fallback;
  }

  let resolvedUrl: string;
  try {
    const signal =
      input.signal ?? AbortSignal.timeout(RESEARCH_HOMEPAGE_FETCH_TIMEOUT_MS);
    const response = await fetchImpl(redirectUrl, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent": "JobPilotCompanyResearch/1.0",
      },
    });
    resolvedUrl = response.url || redirectUrl;
  } catch {
    return fallback;
  }

  let hostname: string;
  try {
    hostname = new URL(resolvedUrl).hostname;
  } catch {
    return fallback;
  }

  if (
    hostname.includes("adzuna.") ||
    hostname.endsWith(".adzuna.com") ||
    hostname === "adzuna.com"
  ) {
    return fallback;
  }

  const root = rootDomainFromHostname(hostname);
  if (!root) return fallback;

  const corporate = storefrontCorporateHomepage(root);
  if (corporate) {
    return {
      homepageUrl: corporate,
      resolvedJobPageUrl: resolvedUrl,
      source: "storefront_override",
    };
  }

  return {
    homepageUrl: `https://${root}`,
    resolvedJobPageUrl: resolvedUrl,
    source: "redirect",
  };
}
