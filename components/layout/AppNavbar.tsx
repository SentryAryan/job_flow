"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Logo from "@/components/layout/Logo";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Find Jobs", href: "/find-jobs" },
  { label: "Profile", href: "/profile" },
] as const;

export default function AppNavbar() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo href="/dashboard" />

        <nav className="flex items-center gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`border-b-2 pb-0.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-text-dark hover:text-accent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
