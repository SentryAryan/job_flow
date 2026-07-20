"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth/AuthProvider";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return <AuthProvider>{children}</AuthProvider>;
}
