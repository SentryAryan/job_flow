"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import {
    parseAppTheme,
    THEME_OPTIONS,
    themeIconForResolved,
    type AppTheme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Compact Light / Dark / System control for the shared Navbar.
 * Reusable on any page that needs an explicit theme control.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = parseAppTheme(theme);
  // Until mounted, SSR + first client paint must match (next-themes has no
  // resolvedTheme on the server; client may already know dark from its script).
  const iconKind = mounted
    ? themeIconForResolved(resolvedTheme)
    : "light";
  const radioValue = mounted ? current : "system";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "cursor-pointer text-text-dark hover:text-accent",
            className,
          )}
          aria-label="Theme"
          disabled={!mounted}
        >
          {iconKind === "dark" ? (
            <Moon className="size-4" aria-hidden />
          ) : (
            <Sun className="size-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup
          value={radioValue}
          onValueChange={(value) => {
            setTheme(parseAppTheme(value));
          }}
        >
          {THEME_OPTIONS.map((option) => (
            <ThemeRadioItem key={option.value} value={option.value} label={option.label} />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeRadioItem({
  value,
  label,
}: {
  value: AppTheme;
  label: string;
}) {
  const Icon =
    value === "light" ? Sun : value === "dark" ? Moon : Monitor;

  return (
    <DropdownMenuRadioItem value={value} className="cursor-pointer gap-2">
      <Icon className="size-4 shrink-0 text-text-muted" aria-hidden />
      <span>{label}</span>
    </DropdownMenuRadioItem>
  );
}
