import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentUser, mockCreateClient } = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockCreateClient = vi.fn(() => ({
    auth: { getCurrentUser: mockGetCurrentUser },
  }));
  return { mockGetCurrentUser, mockCreateClient };
});

vi.mock("@insforge/sdk", () => ({
  createClient: mockCreateClient,
}));

import { requireAuth } from "@/lib/api-auth";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://example.insforge.app";
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = "anon-key";
  });

  it("returns 401 when Authorization header is missing", async () => {
    const result = await requireAuth(new Request("http://localhost/api"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("Unauthorized");
    }
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns 401 when Bearer token is empty", async () => {
    const result = await requireAuth(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer " },
      }),
    );
    expect(result.success).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns the user when JWT is valid", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    });

    const result = await requireAuth(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer jwt-token" },
      }),
    );

    expect(mockCreateClient).toHaveBeenCalledWith({
      baseUrl: "https://example.insforge.app",
      anonKey: "anon-key",
      accessToken: "jwt-token",
      timeout: expect.any(Number),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.id).toBe("user-1");
      expect(result.accessToken).toBe("jwt-token");
    }
  });

  it("returns 401 when getCurrentUser fails", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: { user: null },
      error: { message: "bad token" },
    });

    const result = await requireAuth(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer bad" },
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(401);
    }
  });

  it("returns 503 when getCurrentUser times out", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: { user: null },
      error: { message: "InsForgeError: Request timed out after 30000ms" },
    });

    const result = await requireAuth(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer tok" },
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(503);
      expect(result.error).toMatch(/timed out/i);
    }
  });
});
