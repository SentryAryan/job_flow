"use client";

import type { UserSchema } from "@insforge/sdk";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { identifyUser } from "@/lib/analytics";
import { isTransientError } from "@/lib/errors";
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
      const { data, error } = await insforge.auth.getCurrentUser();
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

    return () => {
      active = false;
      unsubscribe();
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
