"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useUser } from "@/components/auth/AuthProvider";
import { captureEvent, consumePendingOAuthProvider } from "@/lib/analytics";

export default function CallbackPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const capturedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const isOAuthReturn = params.has("insforge_code");

    if (isOAuthReturn && !capturedRef.current) {
      capturedRef.current = true;
      const provider = consumePendingOAuthProvider();
      captureEvent(
        "user_signed_in",
        provider ? { provider } : undefined,
      );
    }

    router.replace("/dashboard");
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
