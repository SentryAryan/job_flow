import { insforge } from "@/lib/insforge-client";

/** Refresh access tokens this many seconds before JWT `exp`. */
export const API_TOKEN_LEEWAY_SECONDS = 120;

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Decode JWT `exp` (seconds) → epoch ms. Returns null if the token is not a
 * parseable JWT with a numeric exp (treat as unusable / needs refresh).
 */
export function getJwtExpMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    const padded =
      pad === 0 ? normalized : `${normalized}${"=".repeat(4 - pad)}`;
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * True when there is no token, exp cannot be read, or exp is within leeway.
 */
export function isAccessTokenExpiring(
  token: string | null | undefined,
  leewaySeconds: number = API_TOKEN_LEEWAY_SECONDS,
): boolean {
  if (!token) return true;
  const expMs = getJwtExpMs(token);
  if (expMs === null) return true;
  return expMs <= Date.now() + leewaySeconds * 1000;
}

/**
 * Cookie-based browser refresh (httpOnly + CSRF). Dedupes concurrent callers.
 */
export async function refreshBrowserSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const { data, error } = await insforge.auth.refreshSession();
      return !error && Boolean(data?.accessToken);
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export type GetAccessTokenOptions = {
  /** Always call refresh before reading the token (e.g. after a 401). */
  forceRefresh?: boolean;
};

/**
 * Access token safe to send as `Authorization: Bearer` to Next API routes.
 *
 * SDK `getValidAccessToken` can return an already-expired JWT when its internal
 * refresh gate (`userToken !== null`) fails — we fall back to
 * `auth.refreshSession()` and re-read.
 */
export async function getAccessTokenForApi(
  options: GetAccessTokenOptions = {},
): Promise<string | null> {
  const http = insforge.getHttpClient();

  if (options.forceRefresh) {
    const refreshed = await refreshBrowserSession();
    if (!refreshed) return null;
  }

  let token = await http.getValidAccessToken(API_TOKEN_LEEWAY_SECONDS);

  if (isAccessTokenExpiring(token, API_TOKEN_LEEWAY_SECONDS)) {
    const refreshed = await refreshBrowserSession();
    if (!refreshed) return null;
    token = await http.getValidAccessToken(API_TOKEN_LEEWAY_SECONDS);
  }

  if (!token || isAccessTokenExpiring(token, 0)) {
    return null;
  }

  return token;
}
