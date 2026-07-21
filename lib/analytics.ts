import posthog from "posthog-js";

import { isPostHogEnabled } from "@/lib/posthog-config";

export type OAuthProvider = "google" | "github";

const OAUTH_PROVIDER_KEY = "jobpilot_oauth_provider";

export function setPendingOAuthProvider(provider: OAuthProvider): void {
  sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider);
}

export function consumePendingOAuthProvider(): OAuthProvider | null {
  const value = sessionStorage.getItem(OAUTH_PROVIDER_KEY);
  sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
  if (value === "google" || value === "github") {
    return value;
  }
  return null;
}

export function captureEvent(
  event: string,
  properties?: Record<string, string | undefined>,
): void {
  if (!isPostHogEnabled()) return;
  posthog.capture(event, properties);
}

export function identifyUser(
  id: string,
  traits: { email?: string | null },
): void {
  if (!isPostHogEnabled()) return;
  posthog.identify(id, traits);
}

export function resetAnalytics(): void {
  if (!isPostHogEnabled()) return;
  posthog.reset();
}
