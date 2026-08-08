/**
 * Theme preference helpers (Light / Dark / System).
 * next-themes values: light | dark | system.
 */

export type AppTheme = "light" | "dark" | "system";

export type ThemeOption = {
  value: AppTheme;
  label: string;
};

export const THEME_OPTIONS: ReadonlyArray<ThemeOption> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export const THEME_STORAGE_KEY = "jobflow-theme";

/** Normalize an unknown preference to a valid AppTheme (default system). */
export function parseAppTheme(value: string | null | undefined): AppTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

/** Icon key for the trigger based on resolved (applied) theme. */
export function themeIconForResolved(
  resolved: string | undefined,
): "light" | "dark" {
  return resolved === "dark" ? "dark" : "light";
}

export function themeOptionLabel(value: AppTheme): string {
  const match = THEME_OPTIONS.find((option) => option.value === value);
  return match?.label ?? "System";
}
