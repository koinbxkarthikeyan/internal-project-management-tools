"use client";

import { useSyncExternalStore } from "react";
import { sessionStore } from "@/lib/auth/sessionStore";
import type { AppUser } from "@/types/auth";

export type AuthStatus = "loading" | "signedIn" | "signedOut";

export type Auth = {
  status: AuthStatus;
  user: AppUser | null;
  /** Admin or Super Admin with access Enabled: can manage users. */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Registered but access Disabled: may only use "What are you working on? > My sprint / My Task". */
  restricted: boolean;
};

/**
 * The current login state, read from the saved login (token + user). It is `loading` until the browser has read it
 * (so the server and first client render agree), then `signedIn` or `signedOut`. AuthGate keeps the user up to date
 * with `/auth/me`, so a role or access change made by an Admin shows up without signing in again.
 */
export function useAuth(): Auth {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.read, () => undefined);

  const user = session?.user ?? null;
  const status: AuthStatus = session === undefined ? "loading" : user ? "signedIn" : "signedOut";
  const restricted = !!user && user.status === "Disabled";
  return {
    status,
    user,
    restricted,
    isAdmin: !!user && !restricted && (user.role === "Admin" || user.role === "Super Admin"),
    isSuperAdmin: !!user && user.role === "Super Admin",
  };
}
