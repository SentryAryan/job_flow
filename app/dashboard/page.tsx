"use client";

// Temporary placeholder for Feature 02 (Auth) verification.
// Replaced by the full dashboard UI in Feature 14.

import { useEffect } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useUser } from "@/components/auth/AuthProvider";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DashboardPageSkeleton } from "@/components/layout/DashboardPageSkeleton";
import Navbar from "@/components/layout/Navbar";
import { captureEvent } from "@/lib/analytics";

function DashboardContent() {
  const { user } = useUser();

  useEffect(() => {
    captureEvent("dashboard_viewed");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-text-primary">
          You are signed in
        </h1>
        <p className="text-sm text-text-secondary">{user?.email}</p>
        <SignOutButton />
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard fallback={<DashboardPageSkeleton />}>
      <DashboardContent />
    </AuthGuard>
  );
}
