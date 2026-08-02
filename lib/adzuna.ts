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

/**
 * Search Adzuna jobs by title (`what`) and optional location (`where`).
 * No sector `category` filter — results can span any Adzuna category.
 * Omits `where` when location is empty.
 */
export async function searchAdzunaJobs(
  params: SearchAdzunaJobsParams,
): Promise<AdzunaJob[]> {
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
  const controller = new AbortController();
  const timeoutMs = 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Adzuna API error: timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = (await response.json()) as AdzunaSearchResponse;
  return Array.isArray(data.results) ? data.results : [];
}
