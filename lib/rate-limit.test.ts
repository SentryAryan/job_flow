import { describe, expect, it } from "vitest";

import {
    MemorySlidingWindowStore,
    checkRateLimits,
} from "@/lib/rate-limit";

describe("checkRateLimits (memory sliding window)", () => {
  it("allows requests under the limit and blocks when exceeded", async () => {
    const store = new MemorySlidingWindowStore();
    const windows = [{ name: "1m", windowMs: 60_000, limit: 2 }];

    const first = await checkRateLimits(store, "user-a", windows);
    const second = await checkRateLimits(store, "user-a", windows);
    const third = await checkRateLimits(store, "user-a", windows);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.blockedBy).toBe("1m");
    expect(third.remaining).toBe(0);
  });

  it("isolates keys per identity", async () => {
    const store = new MemorySlidingWindowStore();
    const windows = [{ name: "1m", windowMs: 60_000, limit: 1 }];

    expect((await checkRateLimits(store, "a", windows)).allowed).toBe(true);
    expect((await checkRateLimits(store, "b", windows)).allowed).toBe(true);
    expect((await checkRateLimits(store, "a", windows)).allowed).toBe(false);
  });
});
