import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAccessTokenForApi } = vi.hoisted(() => ({
  mockGetAccessTokenForApi: vi.fn(),
}));

vi.mock("@/lib/auth-access-token", () => ({
  getAccessTokenForApi: mockGetAccessTokenForApi,
}));

import { authedFetch } from "@/lib/authed-fetch";

describe("authedFetch", () => {
  beforeEach(() => {
    mockGetAccessTokenForApi.mockReset();
    vi.unstubAllGlobals();
  });

  it("returns a synthetic 401 when no access token is available", async () => {
    mockGetAccessTokenForApi.mockResolvedValue(null);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await authedFetch("/api/resume/usage");
    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
  });

  it("attaches Bearer and returns the first response when not 401", async () => {
    mockGetAccessTokenForApi.mockResolvedValue("token-1");
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await authedFetch("/api/resume/generate", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer token-1",
    );
    expect(mockGetAccessTokenForApi).toHaveBeenCalledTimes(1);
  });

  it("retries once after force refresh on 401", async () => {
    mockGetAccessTokenForApi
      .mockResolvedValueOnce("stale")
      .mockResolvedValueOnce("fresh");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("no", { status: 401 }))
      .mockResolvedValueOnce(new Response("yes", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await authedFetch("/api/resume/extract", {
      method: "POST",
      body: new FormData(),
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mockGetAccessTokenForApi).toHaveBeenNthCalledWith(1);
    expect(mockGetAccessTokenForApi).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
    });
    const retryInit = fetchSpy.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(retryInit.headers).get("Authorization")).toBe(
      "Bearer fresh",
    );
  });

  it("does not retry when force refresh also fails", async () => {
    mockGetAccessTokenForApi
      .mockResolvedValueOnce("stale")
      .mockResolvedValueOnce(null);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("no", { status: 401 }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await authedFetch("/api/profile/openrouter-keys");
    expect(response.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
