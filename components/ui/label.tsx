import type { LabelHTMLAttributes, ReactNode } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
};

export function Label({ className = "", children, ...props }: LabelProps) {
  return (
    <label
      className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
