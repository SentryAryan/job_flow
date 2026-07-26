import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockReplace,
  mockUseUser,
  mockSignOut,
  mockCaptureEvent,
  mockResetAnalytics,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockUseUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockCaptureEvent: vi.fn(),
  mockResetAnalytics: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/",
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useUser: () => mockUseUser(),
}));

vi.mock("@/lib/analytics", () => ({
  captureEvent: mockCaptureEvent,
  resetAnalytics: mockResetAnalytics,
}));

import { NavbarCta } from "@/components/layout/NavbarCta";

describe("NavbarCta", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("shows a skeleton while auth is loading", () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
      signOut: mockSignOut,
    });

    const { container } = render(<NavbarCta />);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByText("Get Started")).not.toBeInTheDocument();
  });

  it("shows Get Started link when signed out", () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: true,
      signOut: mockSignOut,
    });

    render(<NavbarCta />);
    const link = screen.getByRole("link", { name: "Get Started" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows account menu when signed in and signs out with analytics", async () => {
    const user = userEvent.setup();
    mockUseUser.mockReturnValue({
      user: {
        id: "u1",
        email: "aria@example.com",
        profile: { name: "Aria Chen" },
      },
      isLoaded: true,
      signOut: mockSignOut,
    });

    render(<NavbarCta />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Sign out/i }));

    expect(mockCaptureEvent).toHaveBeenCalledWith("user_signed_out");
    expect(mockResetAnalytics).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });
});
