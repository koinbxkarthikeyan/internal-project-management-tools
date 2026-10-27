"use client";

import { useSyncExternalStore } from "react";
import { sessionStore } from "@/lib/auth/sessionStore";
import type { AppUser } from "@/types/auth";

export type AuthStatus = "loading" | "signedIn" | "signedOut";

export type Auth = {
  status: AuthStatus;
  user: AppUser | null;
  /** Admin or Super Admin with access Enabled: can create users and owners and manage users. */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** A normal User or a Disabled Admin: may only use "What are you working on? > My sprint / My Task" and Settings. */
  restricted: boolean;
  /** A Disabled normal User: signed in, but may only open Settings (and Sign out). A Disabled Admin works as a normal User instead. */
  settingsOnly: boolean;
  /** The backend says this account must choose its own password first (`mustChangePassword`): like settingsOnly, nothing but Settings and Sign out is reachable. */
  mustChangePassword: boolean;
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
  const accountDisabled = !!user && user.status === "Disabled";
  const mustChangePassword = user?.mustChangePassword === true;
  const settingsOnly = (accountDisabled && user?.role === "User") || mustChangePassword;
  const restricted = !!user && (user.role === "User" || (user.role === "Admin" && accountDisabled));
  return {
    status,
    user,
    restricted,
    settingsOnly,
    mustChangePassword,
    isAdmin: !!user && (user.role === "Super Admin" || (user.role === "Admin" && !accountDisabled)),
    isSuperAdmin: !!user && user.role === "Super Admin",
  };
}
