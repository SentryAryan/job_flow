export default function SectionDivider() {
  return (
    <div
      className="h-20 w-full border-y border-border bg-surface"
      style={{
        backgroundImage:
          "repeating-linear-gradient(-45deg, var(--color-border-light) 0, var(--color-border-light) 1px, transparent 1px, transparent 11px)",
      }}
      aria-hidden="true"
    />
  );
}
