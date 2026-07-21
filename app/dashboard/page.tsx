"use client";

// Temporary placeholder for Feature 02 (Auth) verification.
// Replaced by the full dashboard UI in Feature 14.

import { useEffect } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { captureEvent } from "@/lib/analytics";

function DashboardContent() {
  const { user } = useUser();

  useEffect(() => {
    captureEvent("dashboard_viewed");
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-xl font-semibold text-text-primary">
        You are signed in
      </h1>
      <p className="text-sm text-text-secondary">{user?.email}</p>
      <SignOutButton />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
