"use client";

import type { UserSchema } from "@insforge/sdk";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

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

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (!active) return;
      setUser(error ? null : (data?.user ?? null));
      setIsLoaded(true);
    };

    void load();
    const unsubscribe = insforge.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signOut = async (): Promise<void> => {
    await insforge.auth.signOut();
    setUser(null);
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
