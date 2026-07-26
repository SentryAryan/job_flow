import { afterEach, describe, expect, it, vi } from "vitest";

import {
    isNotFoundError,
    isTransientError,
    withRetry,
    withTimeout,
} from "@/lib/errors";

describe("isTransientError", () => {
  it("detects timeout and network failures", () => {
    expect(isTransientError(new Error("Request timed out after 30000ms"))).toBe(
      true,
    );
    expect(isTransientError({ message: "AbortError" })).toBe(true);
    expect(isTransientError(new Error("Failed to fetch"))).toBe(true);
    expect(isTransientError({ details: "network error" })).toBe(true);
    expect(isTransientError({ message: "Gateway Timeout", statusCode: 504 })).toBe(
      true,
    );
    expect(isTransientError({ statusCode: 504 })).toBe(true);
  });

  it("does not treat auth rejection as transient", () => {
    expect(isTransientError(new Error("Unauthorized"))).toBe(false);
    expect(isTransientError({ message: "Invalid JWT" })).toBe(false);
    expect(isTransientError(new Error("Not authenticated"))).toBe(false);
    expect(isTransientError(new Error("network authentication required"))).toBe(
      false,
    );
  });
});

describe("isNotFoundError", () => {
  it("detects missing storage objects", () => {
    expect(isNotFoundError({ message: "Object not found" })).toBe(true);
    expect(isNotFoundError(new Error("404 Not Found"))).toBe(true);
    expect(isNotFoundError(new Error("No such key"))).toBe(true);
  });

  it("does not treat other failures as not-found", () => {
    expect(isNotFoundError(new Error("Permission denied"))).toBe(false);
    expect(isNotFoundError(new Error("Request timed out"))).toBe(false);
  });
});

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 500)).resolves.toBe("ok");
  });

  it("rejects when the promise hangs past the limit", async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 30, "Request timed out"),
    ).rejects.toThrow("Request timed out");
  });
});

describe("withRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { retries: 2 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then succeeds", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request timed out"))
      .mockResolvedValueOnce("ok");

    const pending = withRetry(fn, { retries: 2, delaysMs: [10, 10] });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Unauthorized"));
    await expect(withRetry(fn, { retries: 2 })).rejects.toThrow("Unauthorized");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
