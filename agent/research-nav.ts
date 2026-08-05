/**
 * Detect pages that are useless for employer research so we skip LLM extract.
 */

const ERROR_URL_PREFIXES = ["chrome-error://", "chromewebdata://"] as const;

const ERROR_TEXT_PATTERNS: RegExp[] = [
  /ERR_SSL_/i,
  /ERR_CERT_/i,
  /ERR_NAME_NOT_RESOLVED/i,
  /ERR_CONNECTION_/i,
  /ERR_TIMED_OUT/i,
  /ERR_ADDRESS_UNREACHABLE/i,
  /ERR_TUNNEL_CONNECTION_FAILED/i,
  /ERR_INVALID_RESPONSE/i,
  /ERR_EMPTY_RESPONSE/i,
  /ERR_NETWORK_CHANGED/i,
  /This site can['\u2019]t be reached/i,
  /This webpage is not available/i,
  /took too long to respond/i,
  /DNS_PROBE_FINISHED/i,
];

/** Hard blocks — bot walls / CDN denials (safe to match in title or body). */
const BLOCK_TEXT_PATTERNS: RegExp[] = [
  /Access Denied/i,
  /don['\u2019]t have permission to access/i,
  /You don't have permission/i,
  /errors\.edgesuite\.net/i,
];

/**
 * Auth-wall titles only. Do NOT match these in body text — retailer chrome
 * (Amazon, Target, etc.) always includes "Sign in" / "Register" in the header.
 */
const AUTH_TITLE_PATTERNS: RegExp[] = [
  /^\s*Sign[\s-]?In(\s*\/\s*Register)?\s*$/i,
  /^\s*Log[\s-]?[Ii]n(\s*\/\s*Register)?\s*$/i,
  /^\s*Register\s*$/i,
  /^\s*Create (an )?account\s*$/i,
  /^\s*Sign[\s-]?In\s*\/\s*Register\s*$/i,
];

/** URL path segments that are never useful for employer research. */
const DENYLIST_PATH_RE =
  /\/(login|signin|sign-in|sign_in|register|signup|sign-up|account|accounts|secure|cart|checkout|bag|basket|wishlist|favourites|favorites)(\/|$)/i;

export type PageNavSignals = {
  url?: string | null;
  title?: string | null;
  bodyText?: string | null;
};

/** True when the URL path is login / account / cart / checkout / etc. */
export function isResearchDenylistUrl(url: string | null | undefined): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return DENYLIST_PATH_RE.test(parsed.pathname);
  } catch {
    return DENYLIST_PATH_RE.test(raw);
  }
}

/** True when the page looks like a Chrome interstitial / network error, not a company site. */
export function isChromeNavigationErrorPage(signals: PageNavSignals): boolean {
  const url = (signals.url ?? "").trim().toLowerCase();
  if (ERROR_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return true;
  }

  const haystack = [signals.title, signals.bodyText]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n");

  if (!haystack) return false;
  return ERROR_TEXT_PATTERNS.some((pattern) => pattern.test(haystack));
}

function isAuthWallTitle(title: string | null | undefined): boolean {
  const trimmed = (title ?? "").trim();
  if (!trimmed) return false;
  return AUTH_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * True when extract would waste OpenRouter calls (error page, Access Denied,
 * dedicated Sign In title, or denylisted account/cart URL).
 *
 * Ambient "Sign in" / "Register" in page body (nav chrome) is NOT enough —
 * that false-positives Amazon and similar retailer homepages.
 */
export function isUnusableResearchPage(signals: PageNavSignals): boolean {
  if (isChromeNavigationErrorPage(signals)) return true;
  if (isResearchDenylistUrl(signals.url)) return true;
  if (isAuthWallTitle(signals.title)) return true;

  const haystack = [signals.title, signals.bodyText]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n");

  if (!haystack) return false;
  return BLOCK_TEXT_PATTERNS.some((pattern) => pattern.test(haystack));
}

type StagehandLikePage = {
  url?: () => string;
  title?: () => Promise<string>;
  evaluate?: (fn: () => string) => Promise<unknown>;
};

/**
 * Best-effort read of URL / title / short body text after goto.
 * Never throws — empty signals mean "unknown, allow extract".
 */
export async function readPageNavSignals(
  page: StagehandLikePage,
): Promise<PageNavSignals> {
  let url: string | null = null;
  let title: string | null = null;
  let bodyText: string | null = null;

  try {
    if (typeof page.url === "function") {
      url = page.url();
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof page.title === "function") {
      title = await page.title();
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof page.evaluate === "function") {
      const raw = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        return text.slice(0, 2000);
      });
      if (typeof raw === "string") {
        bodyText = raw;
      }
    }
  } catch {
    /* ignore */
  }

  return { url, title, bodyText };
}
