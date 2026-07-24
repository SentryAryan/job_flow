"use client";

import type { ReactNode } from "react";
import { Toaster as SonnerToaster } from "sonner";

function IconCircle({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${className}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function SuccessIcon() {
  return (
    <IconCircle className="bg-success text-accent-foreground">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconCircle>
  );
}

function ErrorIcon() {
  return (
    <IconCircle className="bg-error text-error-foreground">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 6 6 18M6 6l12 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </IconCircle>
  );
}

function WarningIcon() {
  return (
    <IconCircle className="bg-warning text-warning-foreground">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconCircle>
  );
}

function InfoIcon() {
  return (
    <IconCircle className="bg-warning text-warning-foreground">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 16v-4M12 8h.01"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </IconCircle>
  );
}

/** App-wide toast host — token-styled via Sonner `classNames` (unstyled base). */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="light"
      closeButton
      duration={3500}
      icons={{
        success: <SuccessIcon />,
        error: <ErrorIcon />,
        warning: <WarningIcon />,
        info: <InfoIcon />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)]",
          title: "text-sm font-medium text-text-primary",
          description: "text-sm text-text-secondary",
          closeButton:
            "cursor-pointer border-0 bg-transparent text-text-muted hover:text-text-primary",
          success: "border-l-4 border-l-success",
          error: "border-l-4 border-l-error",
          warning: "border-l-4 border-l-warning",
          info: "border-l-4 border-l-warning",
          actionButton:
            "cursor-pointer rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-accent-dark",
          cancelButton:
            "cursor-pointer rounded-md border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-primary hover:bg-surface-tertiary",
        },
      }}
    />
  );
}
