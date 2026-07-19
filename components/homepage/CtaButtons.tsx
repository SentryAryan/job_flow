import Link from "next/link";

type CtaButtonsProps = {
  align?: "start" | "center";
};

export default function CtaButtons({ align = "start" }: CtaButtonsProps) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row ${
        align === "center" ? "sm:justify-center" : ""
      }`}
    >
      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
      >
        Get Started
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary"
      >
        Find Your First Match
      </Link>
    </div>
  );
}
