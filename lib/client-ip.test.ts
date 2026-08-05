/** @vitest-environment node */
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getClientIp, hashIpForRateLimit } from "@/lib/client-ip";

describe("getClientIp", () => {
  it("uses the first hop of x-forwarded-for", () => {
    const request = new Request("http://localhost/api", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(getClientIp(request)).toBe("198.51.100.7");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const request = new Request("http://localhost/api", {
      headers: {
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "198.51.100.7",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.1");
  });

  it("returns null when headers are missing or invalid", () => {
    expect(getClientIp(new Request("http://localhost/api"))).toBeNull();
    expect(
      getClientIp(
        new Request("http://localhost/api", {
          headers: { "x-forwarded-for": "not-an-ip" },
        }),
      ),
    ).toBeNull();
    expect(
      getClientIp(
        new Request("http://localhost/api", {
          headers: { "x-real-ip": "   " },
        }),
      ),
    ).toBeNull();
  });

  it("accepts IPv6 addresses", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "2001:db8::1" },
    });
    expect(getClientIp(request)).toBe("2001:db8::1");
  });
});

describe("hashIpForRateLimit", () => {
  it("returns a stable 32-char hex prefix of sha256", () => {
    const ip = "203.0.113.10";
    const expected = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    expect(hashIpForRateLimit(ip)).toBe(expected);
    expect(hashIpForRateLimit(ip)).toBe(hashIpForRateLimit(ip));
    expect(hashIpForRateLimit(ip)).toHaveLength(32);
  });

  it("does not equal the raw IP", () => {
    expect(hashIpForRateLimit("203.0.113.10")).not.toBe("203.0.113.10");
  });
});
