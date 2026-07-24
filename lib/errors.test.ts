import { describe, expect, it } from "vitest";

import { isNotFoundError, isTransientError } from "@/lib/errors";

describe("isTransientError", () => {
  it("detects timeout and network failures", () => {
    expect(isTransientError(new Error("Request timed out after 30000ms"))).toBe(
      true,
    );
    expect(isTransientError({ message: "AbortError" })).toBe(true);
    expect(isTransientError(new Error("Failed to fetch"))).toBe(true);
    expect(isTransientError({ details: "network error" })).toBe(true);
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
