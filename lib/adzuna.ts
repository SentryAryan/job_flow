import dns from "node:dns";

export type AdzunaCountry = "us" | "gb" | "au" | "ca";

export type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1";
  contract_type?: string;
  created: string;
  category: { tag: string; label: string };
};

type AdzunaSearchResponse = {
  results?: AdzunaJob[];
};

/** Prefer A records so broken Adzuna IPv6 (ENETUNREACH) does not fail Happy Eyeballs. */
export function preferIpv4DnsOrder(): void {
  // Node-only — Edge / browsers have no `node:dns`. Startup also sets this via
  // instrumentation-node.ts; searchAdzunaJobs calls again before fetch.
  if (typeof process === "undefined") return;
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
}

const COUNTRY_PATTERNS: ReadonlyArray<{
  country: AdzunaCountry;
  pattern: RegExp;
}> = [
  {
    country: "gb",
    pattern:
      /\b(uk|u\.k\.|united kingdom|england|scotland|wales|london|manchester|birmingham|edinburgh)\b/i,
  },
  {
    country: "au",
    pattern:
      /\b(australia|sydney|melbourne|brisbane|perth|adelaide)\b/i,
  },
  {
    // No bare "ca" — that matches California state suffixes (e.g. "San Francisco, CA").
    country: "ca",
    pattern:
      /\b(canada|toronto|vancouver|montreal|ottawa|calgary|ontario|quebec|alberta|british columbia)\b/i,
  },
  {
    country: "us",
    pattern:
      /\b(usa|u\.s\.a\.|united states|\bus\b|new york|san francisco|seattle|austin|chicago|remote)\b/i,
  },
];

/** Currency prefix for Adzuna salary display by country endpoint. */
export function adzunaCurrencySymbol(country: AdzunaCountry): string {
  switch (country) {
    case "gb":
      return "£";
    case "au":
      return "A$";
    case "ca":
      return "C$";
    case "us":
      return "$";
    default: {
      const _exhaustive: never = country;
      return _exhaustive;
    }
  }
}

/** Infer Adzuna country code from free-text location; default `us`. */
export function detectAdzunaCountry(location: string): AdzunaCountry {
  const trimmed = location.trim();
  if (!trimmed) return "us";

  for (const { country, pattern } of COUNTRY_PATTERNS) {
    if (pattern.test(trimmed)) return country;
  }

  return "us";
}

/**
 * Format Adzuna salary_min/max into `{symbol}XXk - {symbol}YYk`, or null when missing.
 * Pass `currencySymbol` from `adzunaCurrencySymbol(country)` so non-US markets are correct.
 */
export function formatAdzunaSalary(
  salaryMin?: number,
  salaryMax?: number,
  currencySymbol = "$",
): string | null {
  if (
    salaryMin == null ||
    !Number.isFinite(salaryMin) ||
    salaryMin <= 0
  ) {
    return null;
  }

  const minK = Math.round(salaryMin / 1000);
  if (
    salaryMax != null &&
    Number.isFinite(salaryMax) &&
    salaryMax > salaryMin
  ) {
    const maxK = Math.round(salaryMax / 1000);
    return `${currencySymbol}${minK}k - ${currencySymbol}${maxK}k`;
  }

  return `${currencySymbol}${minK}k+`;
}

export type SearchAdzunaJobsParams = {
  jobTitle: string;
  location?: string;
  country?: AdzunaCountry;
  resultsPerPage?: number;
  appId?: string;
  appKey?: string;
  fetchImpl?: typeof fetch;
};

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return false;

  const message = error.message.toLowerCase();
  if (
    message.includes("fetch failed") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enetunreach") ||
    message.includes("network")
  ) {
    return true;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && cause !== null) {
    const code =
      "code" in cause && typeof (cause as { code: unknown }).code === "string"
        ? (cause as { code: string }).code
        : "";
    if (
      code === "ETIMEDOUT" ||
      code === "ENETUNREACH" ||
      code === "ECONNRESET" ||
      code === "ECONNREFUSED" ||
      code === "EAI_AGAIN"
    ) {
      return true;
    }
  }

  return false;
}

function networkErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Adzuna API error: timeout";
  }
  return "Adzuna API error: network unreachable (check IPv6 / firewall; retrying prefers IPv4)";
}

async function fetchAdzunaOnce(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Search Adzuna jobs by title (`what`) and optional location (`where`).
 * No sector `category` filter — results can span any Adzuna category.
 * Omits `where` when location is empty.
 */
export async function searchAdzunaJobs(
  params: SearchAdzunaJobsParams,
): Promise<AdzunaJob[]> {
  preferIpv4DnsOrder();

  const jobTitle = params.jobTitle.trim();
  if (!jobTitle) {
    throw new Error("Job title is required");
  }

  const appId = params.appId ?? process.env.ADZUNA_APP_ID?.trim();
  const appKey = params.appKey ?? process.env.ADZUNA_APP_KEY?.trim();
  if (!appId || !appKey) {
    throw new Error("Adzuna credentials are not configured");
  }

  const location = params.location?.trim() ?? "";
  const country =
    params.country ?? detectAdzunaCountry(location);
  const resultsPerPage = params.resultsPerPage ?? 10;
  const fetchImpl = params.fetchImpl ?? fetch;

  const query = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: jobTitle,
    results_per_page: String(resultsPerPage),
    "content-type": "application/json",
  });

  if (location) {
    query.set("where", location);
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${query}`;
  const timeoutMs = 15_000;

  let response: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetchAdzunaOnce(url, fetchImpl, timeoutMs);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new Error("Adzuna API error: timeout");
      }
      if (!isTransientNetworkError(error) || attempt === 1) {
        throw new Error(networkErrorMessage(error), { cause: error });
      }
      preferIpv4DnsOrder();
    }
  }

  if (!response) {
    throw new Error(networkErrorMessage(lastError), { cause: lastError });
  }

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = (await response.json()) as AdzunaSearchResponse;
  return Array.isArray(data.results) ? data.results : [];
}
