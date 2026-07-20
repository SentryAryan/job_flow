"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useUser } from "@/components/auth/AuthProvider";

type Props = {
  className?: string;
  children: ReactNode;
};

export function AuthAwareCta({ className, children }: Props) {
  const { user, isLoaded } = useUser();
  const href = isLoaded && user ? "/dashboard" : "/login";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
