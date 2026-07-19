import Logo from "@/components/layout/Logo";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Find Jobs", href: "/find-jobs" },
  { label: "Profile", href: "/profile" },
];

export default function Navbar() {
  return (
    <header className="w-full border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-text-dark transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="inline-flex items-center rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
        >
          Start for free
        </Link>
      </div>
    </header>
  );
}
