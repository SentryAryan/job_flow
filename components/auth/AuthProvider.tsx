"use client";

import type { UserSchema } from "@insforge/sdk";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { identifyUser } from "@/lib/analytics";
import {
    getAccessTokenForApi,
    isAccessTokenExpiring,
    refreshBrowserSession,
} from "@/lib/auth-access-token";
import { isTransientError, withTimeout } from "@/lib/errors";
import { insforge } from "@/lib/insforge-client";

type AuthContextValue = {
  user: UserSchema | null;
  isLoaded: boolean;
  signOut: () => Promise<void>;
};

type Props = {
  children: ReactNode;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_LOAD_TIMEOUT_MS = 10_000;
/** Proactive refresh while a tab stays open (access JWTs are short-lived). */
const SESSION_REFRESH_INTERVAL_MS = 8 * 60 * 1000;
/** Refresh when the in-memory JWT is within this many seconds of exp. */
const PROACTIVE_TOKEN_LEEWAY_SECONDS = 180;

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<UserSchema | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const userRef = useRef<UserSchema | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let active = true;

    const setSession = (nextUser: UserSchema | null): void => {
      if (!active) return;
      setUser(nextUser);
      setIsLoaded(true);
      if (nextUser) {
        identifyUser(nextUser.id, { email: nextUser.email });
      }
    };

    const load = async (attempt = 0): Promise<void> => {
      try {
        const { data, error } = await withTimeout(
          insforge.auth.getCurrentUser(),
          AUTH_LOAD_TIMEOUT_MS,
          "Request timed out",
        );
        if (!active) return;

        if (error) {
          const existing = userRef.current;
          if (existing && isTransientError(error)) {
            // Keep session on timeout/network blips so AuthGuard does not bounce mid-session.
            setIsLoaded(true);
            return;
          }
          if (!existing && isTransientError(error) && attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (!active) return;
            await load(attempt + 1);
            return;
          }
          // Auth rejection or exhausted cold-start retries → treat as signed out.
          setSession(null);
          return;
        }

        setSession(data?.user ?? null);
      } catch (error) {
        if (!active) return;
        const existing = userRef.current;
        if (existing && isTransientError(error)) {
          setIsLoaded(true);
          return;
        }
        if (!existing && isTransientError(error) && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          if (!active) return;
          await load(attempt + 1);
          return;
        }
        // Cold-start hang / timeout → stop spinner; treat as signed out.
        setSession(null);
      }
    };

    void load();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      if (event === "signedOut") {
        setSession(null);
        return;
      }
      if (event === "signedIn") {
        void load();
        return;
      }
      // tokenRefreshed: token already in memory — skip getCurrentUser to avoid
      // timeout races that would clear the session.
    });

    const ensureFreshAccessToken = async (): Promise<void> => {
      if (!active || !userRef.current) return;
      try {
        const token = await getAccessTokenForApi();
        // getAccessTokenForApi already refreshes within API leeway; if still
        // close to exp (long-idle tab), force a cookie refresh.
        if (
          !token ||
          isAccessTokenExpiring(token, PROACTIVE_TOKEN_LEEWAY_SECONDS)
        ) {
          await refreshBrowserSession();
        }
      } catch {
        // Proactive refresh must never sign the user out on network blips.
      }
    };

    const onVisibilityOrFocus = (): void => {
      if (document.visibilityState === "hidden") return;
      void ensureFreshAccessToken();
    };

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    const intervalId = window.setInterval(() => {
      void ensureFreshAccessToken();
    }, SESSION_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
      window.clearInterval(intervalId);
    };
  }, []);

  const signOut = async (): Promise<void> => {
    await insforge.auth.signOut();
    setUser(null);
    userRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, isLoaded, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useUser must be used within an AuthProvider");
  }
  return context;
}
