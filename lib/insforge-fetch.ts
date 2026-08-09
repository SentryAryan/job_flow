/**
 * Browser fetch wrapper for InsForge SDK.
 *
 * Default browser HTTP cache can send `If-None-Match` and receive 304.
 * PostgREST/postgrest-js treats 304 as not OK (`res.ok` is false for 304), which
 * yields bogus errors or hung body reads on some CORS paths — seen as
 * `fetchProfile` timeouts on Render while Vercel/local still look fine.
 */
export function createInsforgeBrowserFetch(
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "no-store");
    }

    const response = await baseFetch(input, {
      ...init,
      headers,
      cache: "no-store",
    });

    // Belt-and-suspenders: if a proxy still returns 304, force a full reload.
    if (response.status === 304) {
      await response.body?.cancel().catch(() => undefined);
      const retryHeaders = new Headers(headers);
      retryHeaders.delete("If-None-Match");
      retryHeaders.delete("If-Modified-Since");
      return baseFetch(input, {
        ...init,
        headers: retryHeaders,
        cache: "reload",
      });
    }

    return response;
  };
}
