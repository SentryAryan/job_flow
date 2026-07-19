import Logo from "@/components/layout/Logo";
import Link from "next/link";

const FOOTER_LINKS = [
  { label: "About", href: "/about" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
];

export default function Footer() {
  return (
    <footer className="w-full border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <Logo />

        <nav className="flex items-center gap-6">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
