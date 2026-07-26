import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReplace, mockUseUser } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockUseUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useUser: () => mockUseUser(),
}));

vi.mock("@/components/layout/Navbar", () => ({
  default: function MockNavbar() {
    return <div data-testid="navbar">Navbar</div>;
  },
}));

vi.mock("@/components/layout/DefaultMainSkeleton", () => ({
  DefaultMainSkeleton: function MockDefaultSkeleton() {
    return <div data-testid="default-skeleton">Default skeleton</div>;
  },
}));

import { AuthGuard } from "@/components/auth/AuthGuard";

describe("AuthGuard", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Navbar + fallback while auth is loading", () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard fallback={<div data-testid="page-fallback">Loading page</div>}>
        <div>Protected</div>
      </AuthGuard>,
    );

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("page-fallback")).toBeInTheDocument();
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows default skeleton when no fallback is provided", () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>,
    );

    expect(screen.getByTestId("default-skeleton")).toBeInTheDocument();
  });

  it("redirects to login when loaded without a user", () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: true,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    mockUseUser.mockReturnValue({
      user: { id: "u1", email: "a@b.com" },
      isLoaded: true,
      signOut: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.queryByTestId("navbar")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
