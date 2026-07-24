import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockOnAuthStateChange,
  mockSignOut,
  mockIdentifyUser,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
  mockIdentifyUser: vi.fn(),
}));

vi.mock("@/lib/insforge-client", () => ({
  insforge: {
    auth: {
      getCurrentUser: mockGetCurrentUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  },
}));

vi.mock("@/lib/analytics", () => ({
  identifyUser: mockIdentifyUser,
}));

import { AuthProvider, useUser } from "@/components/auth/AuthProvider";

function AuthProbe() {
  const { user, isLoaded } = useUser();
  return (
    <div>
      <span data-testid="loaded">{String(isLoaded)}</span>
      <span data-testid="user">{user?.id ?? "none"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue(() => undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it("loads the current user on mount", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com" } },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
      expect(screen.getByTestId("user").textContent).toBe("u1");
    });
    expect(mockIdentifyUser).toHaveBeenCalledWith("u1", { email: "a@b.com" });
  });

  it("keeps an existing session on transient getCurrentUser errors", async () => {
    mockGetCurrentUser
      .mockResolvedValueOnce({
        data: { user: { id: "u1", email: "a@b.com" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Request timed out" },
      });

    let authListener: ((event: string) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      authListener = cb;
      return () => undefined;
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("u1");
    });

    authListener?.("signedIn");

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId("user").textContent).toBe("u1");
  });

  it("clears the session on non-transient auth errors", async () => {
    mockGetCurrentUser
      .mockResolvedValueOnce({
        data: { user: { id: "u1", email: "a@b.com" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized" },
      });

    let authListener: ((event: string) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      authListener = cb;
      return () => undefined;
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("u1");
    });

    authListener?.("signedIn");

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("none");
    });
  });

  it("ignores tokenRefreshed without calling getCurrentUser again", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com" } },
      error: null,
    });

    let authListener: ((event: string) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      authListener = cb;
      return () => undefined;
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("u1");
    });

    authListener?.("tokenRefreshed");

    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user").textContent).toBe("u1");
  });
});
