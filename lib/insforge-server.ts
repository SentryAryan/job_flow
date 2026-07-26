import { createClient } from "@insforge/sdk";

/**
 * JWT-scoped InsForge client for API routes (no refresh).
 */
export function createAuthedInsforgeClient(accessToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error("InsForge env missing");
  }
  return createClient({ baseUrl, anonKey, accessToken });
}
