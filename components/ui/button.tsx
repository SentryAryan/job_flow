import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "muted";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border border-accent-dark border-b-[3px] border-b-accent-dark bg-accent text-accent-foreground hover:bg-accent-dark disabled:opacity-50",
  secondary:
    "border border-border border-b-2 border-b-border-muted bg-surface text-text-primary hover:bg-surface-secondary disabled:opacity-50",
  muted:
    "border border-border border-b-2 border-b-border-muted bg-surface-secondary text-text-primary hover:bg-surface-tertiary disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
