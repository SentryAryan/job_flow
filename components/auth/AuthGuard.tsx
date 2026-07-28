"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { useUser } from "@/components/auth/AuthProvider";
import { DefaultMainSkeleton } from "@/components/layout/DefaultMainSkeleton";
import Navbar from "@/components/layout/Navbar";

type Props = {
  children: ReactNode;
  /** Page-shaped skeleton shown while auth hydrates or redirecting to login. */
  fallback?: ReactNode;
};

export function AuthGuard({ children, fallback }: Props) {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && !user) {
      router.replace("/login");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        {fallback ?? <DefaultMainSkeleton />}
      </div>
    );
  }

  return <>{children}</>;
}
