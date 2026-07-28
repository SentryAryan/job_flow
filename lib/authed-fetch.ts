import { getAccessTokenForApi } from "@/lib/auth-access-token";

function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized" }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function withBearer(
  init: RequestInit | undefined,
  accessToken: string,
): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

/**
 * Browser `fetch` that attaches a fresh InsForge access token and retries once
 * after a forced session refresh when the API returns 401.
 *
 * Use for all Next.js API routes that call `requireAuth` (Bearer JWT). Do not
 * use for InsForge SDK calls — the SDK refreshes on its own request path.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await getAccessTokenForApi();
  if (!token) {
    return unauthorizedResponse();
  }

  let response = await fetch(input, withBearer(init, token));

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await getAccessTokenForApi({ forceRefresh: true });
  if (!refreshed) {
    return response;
  }

  return fetch(input, withBearer(init, refreshed));
}
