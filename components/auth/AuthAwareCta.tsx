"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useUser } from "@/components/auth/AuthProvider";

type Props = {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

export function AuthAwareCta({ className, children, onClick }: Props) {
  const { user, isLoaded } = useUser();
  const href = isLoaded && user ? "/dashboard" : "/login";

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
