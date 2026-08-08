import Browserbase from "@browserbasehq/sdk";

import { browserbaseSessionTimeoutSec } from "@/lib/research-timeouts";

function requireBrowserbaseApiKey(): string {
  const key = process.env.BROWSERBASE_API_KEY?.trim();
  if (!key) {
    throw new Error("BROWSERBASE_API_KEY is not configured");
  }
  return key;
}

function requireBrowserbaseProjectId(): string {
  const id = process.env.BROWSERBASE_PROJECT_ID?.trim();
  if (!id) {
    throw new Error("BROWSERBASE_PROJECT_ID is not configured");
  }
  return id;
}

/** Browserbase SDK client — always import from this module. */
export function createBrowserbaseClient(): Browserbase {
  return new Browserbase({ apiKey: requireBrowserbaseApiKey() });
}

/**
 * Single-session company research (homepage + up to 1 sub-page).
 * Default session timeout matches Hobby `maxDuration` headroom
 * (env: BROWSERBASE_SESSION_TIMEOUT_SEC).
 */
export async function createResearchBrowserSession(): Promise<{
  id: string;
}> {
  const bb = createBrowserbaseClient();
  const session = await bb.sessions.create({
    projectId: requireBrowserbaseProjectId(),
    timeout: browserbaseSessionTimeoutSec(),
  });
  return { id: session.id };
}

export function getBrowserbaseCredentials(): {
  apiKey: string;
  projectId: string;
} {
  return {
    apiKey: requireBrowserbaseApiKey(),
    projectId: requireBrowserbaseProjectId(),
  };
}
