import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/** Preferred key index for warm processes (best-effort across requests). */
let preferredKeyIndex = 0;

/**
 * Resolve OpenRouter keys from env.
 * Prefer `OPENROUTER_API_KEYS` (comma / semicolon / whitespace separated).
 * Falls back to single `OPENROUTER_API_KEY` for backward compatibility.
 */
export function getOpenRouterApiKeys(): string[] {
  const multi = process.env.OPENROUTER_API_KEYS ?? "";
  const single = process.env.OPENROUTER_API_KEY ?? "";

  const fromMulti = multi
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates =
    fromMulti.length > 0 ? fromMulti : single.trim() ? [single.trim()] : [];

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of candidates) {
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function openRouterErrorStatus(error: unknown): number | string | undefined {
  if (error == null || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const candidates = [
    record.statusCode,
    record.status,
    record.code,
    (record.cause as Record<string, unknown> | undefined)?.statusCode,
    (record.cause as Record<string, unknown> | undefined)?.status,
    (record.response as Record<string, unknown> | undefined)?.status,
  ];
  for (const status of candidates) {
    if (status !== undefined && status !== null) return status as number | string;
  }
  return undefined;
}

function openRouterErrorMessage(error: unknown): string {
  if (error == null) return "";
  const record =
    typeof error === "object" ? (error as Record<string, unknown>) : null;
  return [
    error instanceof Error ? error.message : "",
    typeof record?.message === "string" ? record.message : "",
    typeof record?.data === "string" ? record.data : "",
    typeof record?.responseBody === "string" ? record.responseBody : "",
    typeof record?.body === "string" ? record.body : "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Detect OpenRouter / provider rate-limit or daily quota exhaustion. */
export function isOpenRouterRateLimitError(error: unknown): boolean {
  if (error == null) return false;

  const status = openRouterErrorStatus(error);
  if (status === 429 || status === "429") return true;

  return /rate[_\s-]?limit|too many requests|quota|daily\s*(limit|quota)|free\s*models?\s*(limit|quota)|insufficient[_\s-]?credits|usage[_\s-]?limit|exhausted|429/.test(
    openRouterErrorMessage(error),
  );
}

/** Detect invalid / unauthorized OpenRouter API keys. */
export function isOpenRouterAuthError(error: unknown): boolean {
  if (error == null) return false;

  const status = openRouterErrorStatus(error);
  if (
    status === 401 ||
    status === "401" ||
    status === 403 ||
    status === "403"
  ) {
    return true;
  }

  return /invalid[_\s-]?api[_\s-]?key|incorrect[_\s-]?api[_\s-]?key|unauthorized|authentication|not[_\s-]?a[_\s-]?valid[_\s-]?api|user[_\s-]?not[_\s-]?found|no[_\s-]?auth/.test(
    openRouterErrorMessage(error),
  );
}

/** Key is unusable for BYOK guidance (auth failure or quota exhausted). */
export function isOpenRouterKeyUnusableError(error: unknown): boolean {
  return isOpenRouterAuthError(error) || isOpenRouterRateLimitError(error);
}

export type OpenRouterFailoverOptions = {
  /** When set (non-empty), use only these keys — no platform env fallback. */
  keys?: string[];
};

function resolveKeyPool(override?: string[]): {
  keys: string[];
  usingOverride: boolean;
} {
  if (override && override.length > 0) {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const raw of override) {
      const key = raw.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    if (keys.length > 0) {
      return { keys, usingOverride: true };
    }
  }

  return { keys: getOpenRouterApiKeys(), usingOverride: false };
}

/**
 * Returns the configured language model for server-side AI calls.
 * Default: OpenRouter free router (`openrouter/free`) with response-healing.
 * Pass `apiKey` to target a specific key (used by failover).
 * Pass `keysOverride` when resolving the sticky index from a BYOK pool.
 */
export function getLanguageModel(apiKey?: string, keysOverride?: string[]) {
  const provider = process.env.AI_PROVIDER ?? "openrouter";
  const modelId = process.env.AI_MODEL ?? "openrouter/free";
  const { keys, usingOverride } = resolveKeyPool(keysOverride);

  if (provider !== "openrouter") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }

  const stickyIndex = usingOverride
    ? 0
    : preferredKeyIndex % Math.max(keys.length, 1);

  const resolvedKey = apiKey?.trim() || keys[stickyIndex] || keys[0];

  if (!resolvedKey) {
    throw new Error(
      usingOverride
        ? "No OpenRouter keys available"
        : "OPENROUTER_API_KEYS (or OPENROUTER_API_KEY) is not configured",
    );
  }

  const openrouter = createOpenRouter({ apiKey: resolvedKey });

  return openrouter(modelId, {
    plugins: [{ id: "response-healing" }],
  });
}

/**
 * Run an AI call with in-request OpenRouter key failover.
 * On rate-limit / quota errors, retries with the next key in the same request.
 * Sticky preferred index helps warm Node processes skip recently exhausted keys
 * (platform keys only — BYOK overrides always start at index 0).
 */
export async function withOpenRouterKeyFailover<T>(
  run: (model: ReturnType<typeof getLanguageModel>) => Promise<T>,
  options?: OpenRouterFailoverOptions,
): Promise<T> {
  const { keys, usingOverride } = resolveKeyPool(options?.keys);
  if (keys.length === 0) {
    throw new Error(
      usingOverride
        ? "No OpenRouter keys available"
        : "OPENROUTER_API_KEYS (or OPENROUTER_API_KEY) is not configured",
    );
  }

  const start = usingOverride ? 0 : preferredKeyIndex % keys.length;
  let lastError: unknown;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const index = (start + attempt) % keys.length;
    const key = keys[index]!;

    try {
      const result = await run(getLanguageModel(key, keys));
      if (!usingOverride) {
        preferredKeyIndex = index;
      }
      return result;
    } catch (error) {
      lastError = error;
      const canRetry =
        isOpenRouterRateLimitError(error) && attempt < keys.length - 1;

      if (canRetry) {
        console.warn(
          `OpenRouter key #${index + 1}/${keys.length} rate-limited or quota exhausted; trying next key`,
        );
        if (!usingOverride) {
          preferredKeyIndex = (index + 1) % keys.length;
        }
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/** Test helper — reset sticky key index between unit tests. */
export function resetOpenRouterKeyIndexForTests() {
  preferredKeyIndex = 0;
}
