/**
 * Lightweight OpenRouter auth probe used when saving BYOK keys.
 * Calls GET /api/v1/key — does not charge generation usage.
 */

export type OpenRouterKeyValidation =
  | { ok: true }
  | { ok: false; error: string };

const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const VALIDATE_TIMEOUT_MS = 10_000;

export async function validateOpenRouterApiKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterKeyValidation> {
  const key = apiKey.trim();
  if (!key) {
    return { ok: false, error: "OpenRouter API key is required" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);

  try {
    const response = await fetchImpl(OPENROUTER_KEY_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error:
          "This OpenRouter key isn’t valid. Check it on openrouter.ai and try again.",
      };
    }

    if (response.status === 429) {
      return {
        ok: false,
        error:
          "OpenRouter rate-limited this key while checking it. Try again in a moment.",
      };
    }

    return {
      ok: false,
      error:
        "Could not verify this OpenRouter key right now. Please try again.",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        error: "Timed out verifying this OpenRouter key. Please try again.",
      };
    }
    return {
      ok: false,
      error:
        "Could not reach OpenRouter to verify this key. Please try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}
