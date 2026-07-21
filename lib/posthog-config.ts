const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export function getPostHogHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST;
}

export function getPostHogAssetsHost(): string {
  const url = new URL(getPostHogHost());
  if (url.hostname.endsWith(".i.posthog.com")) {
    url.hostname = url.hostname.replace(".i.posthog.com", "-assets.i.posthog.com");
  }
  return url.origin;
}

export function getPostHogUiHost(): string {
  const url = new URL(getPostHogHost());
  if (url.hostname.endsWith(".i.posthog.com")) {
    url.hostname = url.hostname.replace(".i.posthog.com", ".posthog.com");
  }
  return url.origin;
}

export function isPostHogEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
}
