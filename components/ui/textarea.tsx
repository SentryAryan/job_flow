import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

function hasFilledValue(value: TextareaProps["value"]): boolean {
  if (value == null) return false;
  return String(value).length > 0;
}

const FIELD_BORDER =
  "border border-border border-b-2 border-b-border-muted";

export function Textarea({
  className = "",
  value,
  defaultValue,
  ...props
}: TextareaProps) {
  const filled =
    value !== undefined
      ? hasFilledValue(value)
      : hasFilledValue(defaultValue as TextareaProps["value"]);

  return (
    <textarea
      value={value}
      defaultValue={defaultValue}
      className={`w-full rounded-md ${FIELD_BORDER} px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:border-b-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-secondary ${
        filled ? "bg-surface-secondary" : "bg-surface"
      } ${className}`}
      {...props}
    />
  );
}
