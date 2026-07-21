"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import posthog from "posthog-js";

import { useUser } from "@/components/auth/AuthProvider";
import Navbar from "@/components/layout/Navbar";
import { insforge } from "@/lib/insforge-client";

type Provider = "google" | "github";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-accent"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden="true"
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect signed-in users away from /login (never render interactive form for them).
  useEffect(() => {
    if (isLoaded && user) {
      router.replace("/dashboard");
    }
  }, [isLoaded, user, router]);

  // OAuth leaves this page via a full navigation. Browser Back often restores it
  // from bfcache with React state frozen (pending still "Redirecting...").
  // pageshow fires on every show, including bfcache restore — reset stuck UI.
  useEffect(() => {
    const resetOAuthUi = (): void => {
      setPending(null);
      setError(null);
    };
    window.addEventListener("pageshow", resetOAuthUi);
    return () => window.removeEventListener("pageshow", resetOAuthUi);
  }, []);

  const signIn = async (provider: Provider): Promise<void> => {
    setError(null);
    setPending(provider);
    posthog.capture("sign_in_started", { provider });
    const { error: oauthError } = await insforge.auth.signInWithOAuth(provider, {
      redirectTo: `${window.location.origin}/callback`,
    });
    if (oauthError) {
      setPending(null);
      setError("Something went wrong starting sign in. Please try again.");
      posthog.capture("sign_in_failed", { provider });
    }
  };

  // Auth still hydrating, or signed-in user about to leave — no form flash, no clicks.
  if (!isLoaded || user) {
    return <AuthLoadingScreen />;
  }

  const isBusy = pending !== null;
  const providerButtonClass = `inline-flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors ${
    isBusy
      ? "cursor-not-allowed opacity-70"
      : "cursor-pointer hover:bg-surface-secondary"
  }`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-[760px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] md:grid-cols-2">
          <div
            className="flex flex-col justify-center p-8 md:p-10"
            style={{
              backgroundImage:
                "radial-gradient(120% 120% at 0% 0%, var(--color-accent-light) 0%, transparent 45%), linear-gradient(135deg, var(--color-accent-muted), var(--color-surface) 70%)",
            }}
          >
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
              <ShieldIcon />
              OAuth secured by InsForge
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] text-text-primary">
              Sign in and let the agent prep your next application.
            </h1>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-text-secondary">
              Connect with Google or GitHub to start building your profile,
              matching jobs, and creating tailored application materials.
            </p>

            <p className="mt-8 text-xs text-text-muted">
              New users are routed to profile setup after sign-in.
            </p>
          </div>

          <div className="flex flex-col justify-center border-t border-border p-8 md:border-l md:border-t-0 md:p-10">
            <p className="text-xs text-text-muted">Welcome to</p>
            <h2 className="mt-1 text-2xl font-bold text-text-primary">
              JobPilot
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Choose your preferred provider to continue.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => signIn("google")}
                disabled={isBusy}
                className={providerButtonClass}
              >
                <GoogleIcon />
                {pending === "google" ? "Redirecting..." : "Continue with Google"}
              </button>

              <button
                type="button"
                onClick={() => signIn("github")}
                disabled={isBusy}
                className={providerButtonClass}
              >
                <GitHubIcon />
                {pending === "github" ? "Redirecting..." : "Continue with GitHub"}
              </button>
            </div>

            {error ? (
              <p className="mt-4 text-sm text-error">{error}</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
