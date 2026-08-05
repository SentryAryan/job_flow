import { isResearchDenylistUrl } from "@/agent/research-nav";
import type { HomepageExtract } from "@/agent/research-schemas";

const HTTP_URL_RE = /^https?:\/\//i;

const FALLBACK_PATHS = ["/about", "/careers", "/who-we-are"] as const;

export function isNavigableHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!HTTP_URL_RE.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Keep only navigable absolute http(s) URLs; resolve relative paths against homepage.
 * Drops Stagehand element IDs (e.g. "3-994") that were not rewritten to hrefs.
 */
export function normalizeResearchPageLinks(
  links: HomepageExtract["pageLinks"],
  homepageUrl: string,
): HomepageExtract["pageLinks"] {
  let origin: string;
  try {
    origin = new URL(homepageUrl).origin;
  } catch {
    origin = "";
  }

  const seen = new Set<string>();
  const normalized: HomepageExtract["pageLinks"] = [];

  for (const link of links) {
    const raw = link.url.trim();
    if (!raw) continue;

    let absolute = raw;
    if (!HTTP_URL_RE.test(raw) && origin && raw.startsWith("/")) {
      absolute = `${origin}${raw}`;
    }

    if (!isNavigableHttpUrl(absolute)) continue;
    if (isResearchDenylistUrl(absolute)) continue;
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    normalized.push({ ...link, url: absolute });
  }

  return normalized;
}

/**
 * Same-origin fallback paths when extract yields no navigable pageLinks.
 */
export function fallbackCompanyPageUrls(
  homepageUrl: string,
  max = 1,
): HomepageExtract["pageLinks"] {
  let origin: string;
  try {
    origin = new URL(homepageUrl).origin;
  } catch {
    return [];
  }

  const kinds: Array<HomepageExtract["pageLinks"][number]["kind"]> = [
    "about",
    "careers",
    "about",
  ];

  return FALLBACK_PATHS.slice(0, max).map((path, index) => ({
    url: `${origin}${path}`,
    kind: kinds[index] ?? "other",
  }));
}

/**
 * Prefer preferred kinds from normalized links; if empty, use same-origin fallbacks.
 */
export function resolveSubPageTargets(
  links: HomepageExtract["pageLinks"],
  homepageUrl: string,
  max = 1,
): HomepageExtract["pageLinks"] {
  const normalized = normalizeResearchPageLinks(links, homepageUrl);
  if (normalized.length === 0) {
    return fallbackCompanyPageUrls(homepageUrl, max);
  }
  // Prefer about/careers/team/engineering/blog via caller pickSubPageLinks
  return normalized;
}
