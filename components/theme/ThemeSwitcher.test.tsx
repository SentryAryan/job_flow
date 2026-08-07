import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

const setTheme = vi.fn();
const useThemeMock = vi.fn();

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => useThemeMock(),
}));

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    setTheme.mockClear();
    useThemeMock.mockReturnValue({
      theme: "system",
      setTheme,
      resolvedTheme: "light",
    });
  });

  it("opens menu and selects Dark", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Theme" })).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: "Theme" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Dark/i }));

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("shows Moon icon when resolved theme is dark after mount", async () => {
    useThemeMock.mockReturnValue({
      theme: "dark",
      setTheme,
      resolvedTheme: "dark",
    });
    render(<ThemeSwitcher />);
    const button = screen.getByRole("button", { name: "Theme" });
    await waitFor(() => {
      expect(button.querySelector("svg.lucide-moon")).toBeTruthy();
    });
  });
});
