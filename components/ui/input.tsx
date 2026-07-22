import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

function hasFilledValue(value: InputProps["value"]): boolean {
  if (value == null) return false;
  return String(value).length > 0;
}

/** Elevated field chrome: thin gray sides/top, slightly heavier bottom edge. */
const FIELD_BORDER =
  "border border-border border-b-2 border-b-border-muted";

export function Input({ className = "", value, defaultValue, ...props }: InputProps) {
  const filled =
    value !== undefined
      ? hasFilledValue(value)
      : hasFilledValue(defaultValue as InputProps["value"]);

  return (
    <input
      value={value}
      defaultValue={defaultValue}
      className={`w-full rounded-md ${FIELD_BORDER} px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:border-b-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-secondary ${
        filled ? "bg-surface-secondary" : "bg-surface"
      } ${className}`}
      {...props}
    />
  );
}
