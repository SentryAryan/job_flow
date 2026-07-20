"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useUser } from "@/components/auth/AuthProvider";

export default function CallbackPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [isLoaded, user, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden="true"
        />
        <p className="text-sm text-text-secondary">Signing you in...</p>
      </div>
    </main>
  );
}
