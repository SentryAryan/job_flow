import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetValidAccessToken, mockRefreshSession } = vi.hoisted(() => ({
  mockGetValidAccessToken: vi.fn(),
  mockRefreshSession: vi.fn(),
}));

vi.mock("@/lib/insforge-client", () => ({
  insforge: {
    getHttpClient: () => ({
      getValidAccessToken: mockGetValidAccessToken,
    }),
    auth: {
      refreshSession: mockRefreshSession,
    },
  },
}));

import {
    getAccessTokenForApi,
    getJwtExpMs,
    isAccessTokenExpiring,
    refreshBrowserSession,
} from "@/lib/auth-access-token";

function makeJwt(expSecondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp, sub: "user-1" })).toString(
    "base64url",
  );
  return `${header}.${payload}.sig`;
}

describe("auth-access-token", () => {
  beforeEach(() => {
    mockGetValidAccessToken.mockReset();
    mockRefreshSession.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getJwtExpMs / isAccessTokenExpiring", () => {
    it("reads exp from a JWT", () => {
      const token = makeJwt(300);
      const expMs = getJwtExpMs(token);
      expect(expMs).not.toBeNull();
      expect(expMs!).toBeGreaterThan(Date.now());
    });

    it("treats missing/invalid tokens as expiring", () => {
      expect(isAccessTokenExpiring(null)).toBe(true);
      expect(isAccessTokenExpiring("not-a-jwt")).toBe(true);
      expect(isAccessTokenExpiring("a.b")).toBe(true);
    });

    it("flags tokens inside the leeway window", () => {
      const token = makeJwt(30);
      expect(isAccessTokenExpiring(token, 120)).toBe(true);
      expect(isAccessTokenExpiring(token, 0)).toBe(false);
    });
  });

  describe("refreshBrowserSession", () => {
    it("dedupes concurrent refresh calls", async () => {
      let resolveRefresh!: (value: {
        data: { accessToken: string } | null;
        error: null;
      }) => void;
      mockRefreshSession.mockReturnValue(
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
      );

      const a = refreshBrowserSession();
      const b = refreshBrowserSession();
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);

      resolveRefresh({ data: { accessToken: "new" }, error: null });
      await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    });
  });

  describe("getAccessTokenForApi", () => {
    it("returns a fresh token from the SDK when not expiring", async () => {
      const token = makeJwt(600);
      mockGetValidAccessToken.mockResolvedValue(token);

      await expect(getAccessTokenForApi()).resolves.toBe(token);
      expect(mockRefreshSession).not.toHaveBeenCalled();
    });

    it("refreshes when SDK returns an expired token", async () => {
      const expired = makeJwt(-10);
      const fresh = makeJwt(600);
      mockGetValidAccessToken
        .mockResolvedValueOnce(expired)
        .mockResolvedValueOnce(fresh);
      mockRefreshSession.mockResolvedValue({
        data: { accessToken: fresh },
        error: null,
      });

      await expect(getAccessTokenForApi()).resolves.toBe(fresh);
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    });

    it("forceRefresh always calls refreshSession first", async () => {
      const fresh = makeJwt(600);
      mockRefreshSession.mockResolvedValue({
        data: { accessToken: fresh },
        error: null,
      });
      mockGetValidAccessToken.mockResolvedValue(fresh);

      await expect(getAccessTokenForApi({ forceRefresh: true })).resolves.toBe(
        fresh,
      );
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    });

    it("returns null when refresh fails", async () => {
      mockGetValidAccessToken.mockResolvedValue(makeJwt(-5));
      mockRefreshSession.mockResolvedValue({
        data: null,
        error: { message: "nope" },
      });

      await expect(getAccessTokenForApi()).resolves.toBeNull();
    });
  });
});
