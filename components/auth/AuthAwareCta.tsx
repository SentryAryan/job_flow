"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useUser } from "@/components/auth/AuthProvider";

type Props = {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  /** Destination when signed out. Default: `/login`. */
  hrefWhenGuest?: string;
  /** Destination when signed in. Default: `/find-jobs` (never bounce homepage away). */
  hrefWhenAuthed?: string;
};

export function AuthAwareCta({
  className,
  children,
  onClick,
  hrefWhenGuest = "/login",
  hrefWhenAuthed = "/find-jobs",
}: Props) {
  const { user, isLoaded } = useUser();
  const href = isLoaded && user ? hrefWhenAuthed : hrefWhenGuest;

  return (
    <Link
      href={href}
      className={`cursor-pointer ${className ?? ""}`.trim()}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
