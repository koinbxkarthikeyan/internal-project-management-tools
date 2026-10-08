"use client";

import { useSyncExternalStore } from "react";
import { usersStore } from "@/lib/auth/userStore";
import type { AppUser } from "@/types/auth";

const EMPTY: AppUser[] = [];

/** The users for the pickers (from the backend, cached in this browser); empty on the server render. */
export function useUsers(): AppUser[] {
  return useSyncExternalStore(usersStore.subscribe, usersStore.read, () => EMPTY);
}
