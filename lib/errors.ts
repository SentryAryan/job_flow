/**
 * True for timeouts, aborts, and network failures — not definitive auth rejection.
 * Used to avoid clearing an in-memory session on flaky InsForge calls.
 */
export function isTransientError(error: unknown): boolean {
  const text = errorMessage(error);
  return /timed out|timeout|AbortError|network error|network failure|Failed to fetch|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
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
  }
  return String(error);
}
