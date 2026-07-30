import { createClient, type UserSchema } from "@insforge/sdk";

import { errorMessage, isTransientError } from "@/lib/errors";
import { INSFORGE_SERVER_TIMEOUT_MS } from "@/lib/insforge-server";

export type AuthenticatedUser = UserSchema;

export type AuthResult =
  | { success: true; user: AuthenticatedUser; accessToken: string }
  | { success: false; status: 401 | 503; error: string };

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Verify the caller's InsForge JWT from the Authorization header.
 * Seeds a server client with accessToken (no refresh) and calls getCurrentUser.
 */
export async function requireAuth(
  request: Request,
): Promise<AuthResult> {
  const accessToken = parseBearerToken(request.headers.get("Authorization"));
  if (!accessToken) {
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    console.error("InsForge env missing for API auth");
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const client = createClient({
    baseUrl,
    anonKey,
    accessToken,
    timeout: INSFORGE_SERVER_TIMEOUT_MS,
  });

  const { data, error } = await client.auth.getCurrentUser();
  if (error || !data?.user) {
    if (error && isTransientError(error)) {
      console.error("[api-auth] getCurrentUser transient", errorMessage(error));
      return {
        success: false,
        status: 503,
        error: "Authentication service timed out. Please try again.",
      };
    }
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  return {
    success: true,
    user: data.user,
    accessToken,
  };
}
