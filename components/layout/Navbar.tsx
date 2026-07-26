"use client";

import { LayoutGrid, Search, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import Logo from "@/components/layout/Logo";
import { NavbarCta } from "@/components/layout/NavbarCta";
import { cn } from "@/lib/utils";

const NAV_ITEMS: ReadonlyArray<{
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Find Jobs", href: "/find-jobs", icon: Search },
  { label: "Profile", href: "/profile", icon: User },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo href="/" />

        <nav className="flex items-center gap-6 sm:gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 pb-0.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-text-dark hover:text-accent",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <NavbarCta />
      </div>
    </header>
  );
}
