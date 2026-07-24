"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { Toaster } from "@/components/ui/toaster";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  );
}
