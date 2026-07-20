"use client";

// Temporary placeholder for Feature 02 (Auth) verification.
// Replaced by the full dashboard UI in Feature 14.

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import { SignOutButton } from "@/components/auth/SignOutButton";

function DashboardContent() {
  const { user } = useUser();

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
