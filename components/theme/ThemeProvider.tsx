"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * App-wide color scheme (light / dark / system).
 * Applies `class="dark"` on `<html>` when resolved theme is dark.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="jobpilot-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
