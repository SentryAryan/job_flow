import Link from "next/link";

type LogoProps = {
  href?: string;
};

export default function Logo({ href = "/" }: LogoProps) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-[10px]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--color-accent), var(--color-accent-dark))",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="text-white"
          aria-hidden="true"
        >
          <path
            d="M3 11.5 21 3l-8.5 18-2.2-7.3L3 11.5Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="text-[19px] font-bold text-text-primary">JobPilot</span>
    </Link>
  );
}
