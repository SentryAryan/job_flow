"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useUser } from "@/components/auth/AuthProvider";

export function SignOutButton() {
  const router = useRouter();
  const { signOut } = useUser();
  const [pending, setPending] = useState(false);

  const handleSignOut = async (): Promise<void> => {
    setPending(true);
    await signOut();
    router.replace("/");
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
