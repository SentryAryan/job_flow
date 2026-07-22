import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
