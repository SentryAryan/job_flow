/**
 * True for timeouts, aborts, and network failures — not definitive auth rejection.
 * Used to avoid clearing an in-memory session on flaky InsForge calls.
 */
export function isTransientError(error: unknown): boolean {
  const text = errorMessage(error);
  // Avoid matching phrases like "network authentication required".
  if (/unauthorized|invalid jwt|not authenticated|forbidden/i.test(text)) {
    return false;
  }
  return /timed out|timeout|AbortError|network error|network failure|Failed to fetch|ECONNRESET|ETIMEDOUT|fetch failed|502|503|504|bad gateway|gateway timeout|cloudflare|upstream/i.test(
    text,
  );
}

/** True when a storage remove targets an object that is already gone (expected on replace). */
export function isNotFoundError(error: unknown): boolean {
  const text = errorMessage(error);
  return /object not found|not found|404|no such (object|key|file)/i.test(text);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      return (error as { message: string }).message;
    }
    if (
      "details" in error &&
      typeof (error as { details: unknown }).details === "string"
    ) {
      return (error as { details: string }).details;
    }
    if (
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
    ) {
      const status = (error as { statusCode: number }).statusCode;
      if (status >= 500) return `HTTP ${status}`;
    }
    if (
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
    ) {
      const status = (error as { status: number }).status;
      if (status >= 500) return `HTTP ${status}`;
    }
  }
  return String(error);
}

/** Reject if `promise` does not settle within `ms` (avoids infinite loading on hung SDK calls). */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message = "Request timed out",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type WithRetryOptions = {
  /** Extra attempts after the first (default 2 → 3 total tries). */
  retries?: number;
  /** Delay before attempt 2, 3, … (ms). */
  delaysMs?: readonly number[];
  shouldRetry?: (error: unknown) => boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry an async operation on transient failures (timeouts, 5xx, network).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const delaysMs = options.delaysMs ?? [500, 1500];
  const shouldRetry = options.shouldRetry ?? isTransientError;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      const delay = delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 1000;
      await sleep(delay);
    }
  }

  throw lastError;
}
