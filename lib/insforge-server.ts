import { createClient } from "@insforge/sdk";

import { parsePositiveEnvMs } from "@/lib/parse-env-ms";

/**
 * Server InsForge client timeout (ms). Default SDK 30s is too short for
 * ap-southeast auth + DB; align with browser client unless overridden.
 */
export const INSFORGE_SERVER_TIMEOUT_MS = parsePositiveEnvMs(
  [
    process.env.INSFORGE_SERVER_TIMEOUT_MS,
    process.env.NEXT_PUBLIC_INSFORGE_TIMEOUT_MS,
  ],
  60_000,
);

/**
 * JWT-scoped InsForge client for API routes (no refresh).
 */
export function createAuthedInsforgeClient(accessToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error("InsForge env missing");
  }
  return createClient({
    baseUrl,
    anonKey,
    accessToken,
    timeout: INSFORGE_SERVER_TIMEOUT_MS,
  });
}
