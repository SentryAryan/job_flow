/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuth,
  mockLoadStored,
  mockSaveStored,
  mockCreateStoredKey,
  mockValidateKey,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockLoadStored: vi.fn(),
  mockSaveStored: vi.fn(),
  mockCreateStoredKey: vi.fn((plaintext: string) => ({
    id: `id-${plaintext.slice(-4)}`,
    ciphertext: "c",
    iv: "i",
    tag: "t",
    last4: plaintext.slice(-4),
    created_at: "2026-01-01T00:00:00.000Z",
  })),
  mockValidateKey: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/insforge-server", () => ({
  createAuthedInsforgeClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/openrouter-key-validate", () => ({
  validateOpenRouterApiKey: mockValidateKey,
}));

vi.mock("@/lib/byok-keys", async () => {
  const actual = await vi.importActual<typeof import("@/lib/byok-keys")>(
    "@/lib/byok-keys",
  );
  return {
    ...actual,
    loadStoredByokKeys: mockLoadStored,
    saveStoredByokKeys: mockSaveStored,
    createStoredKey: mockCreateStoredKey,
    decryptKey: (stored: { last4: string }) => `sk-or-v1-existing-${stored.last4}`,
  };
});

import { DELETE, GET, POST } from "@/app/api/profile/openrouter-keys/route";

describe("/api/profile/openrouter-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BYOK_ENCRYPTION_SECRET", "test-secret-for-unit-tests");
    mockRequireAuth.mockResolvedValue({
      success: true,
      user: { id: "user-1" },
      accessToken: "tok",
    });
    mockLoadStored.mockResolvedValue([]);
    mockValidateKey.mockResolvedValue({ ok: true });
    mockSaveStored.mockImplementation(
      async (_id: string, _client: unknown, keys: unknown) => keys,
    );
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      success: false,
      status: 401,
      error: "Unauthorized",
    });
    const res = await GET(new Request("http://localhost/api/profile/openrouter-keys"));
    expect(res.status).toBe(401);
  });

  it("GET returns masked keys", async () => {
    mockLoadStored.mockResolvedValue([
      {
        id: "k1",
        ciphertext: "c",
        iv: "i",
        tag: "t",
        last4: "abcd",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/profile/openrouter-keys", {
        headers: { Authorization: "Bearer tok" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.hasKeys).toBe(true);
    expect(body.data.keys).toEqual([
      { id: "k1", last4: "abcd", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("POST validates key format", async () => {
    const res = await POST(
      new Request("http://localhost/api/profile/openrouter-keys", {
        method: "POST",
        headers: {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: "not-valid" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST rejects keys that fail OpenRouter verification", async () => {
    mockValidateKey.mockResolvedValue({
      ok: false,
      error:
        "This OpenRouter key isn’t valid. Check it on openrouter.ai and try again.",
    });

    const res = await POST(
      new Request("http://localhost/api/profile/openrouter-keys", {
        method: "POST",
        headers: {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: "sk-or-v1-abcdefghijkl" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/isn’t valid/i);
    expect(mockSaveStored).not.toHaveBeenCalled();
  });

  it("POST saves a valid key", async () => {
    const res = await POST(
      new Request("http://localhost/api/profile/openrouter-keys", {
        method: "POST",
        headers: {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: "sk-or-v1-abcdefghijkl" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.hasKeys).toBe(true);
    expect(body.data.keys[0].last4).toBe("ijkl");
    expect(mockSaveStored).toHaveBeenCalled();
  });

  it("DELETE removes by id", async () => {
    mockLoadStored.mockResolvedValue([
      {
        id: "k1",
        ciphertext: "c",
        iv: "i",
        tag: "t",
        last4: "abcd",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const res = await DELETE(
      new Request("http://localhost/api/profile/openrouter-keys", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "k1" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.hasKeys).toBe(false);
    expect(mockSaveStored).toHaveBeenCalledWith("user-1", expect.anything(), []);
  });
});
