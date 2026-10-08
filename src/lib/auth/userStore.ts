import { STORAGE_KEYS } from "@/constants/auth";
import { getUserOptions } from "@/services/userService";
import type { AppUser } from "@/types/auth";
import { normalizeEmail } from "./emailRules";
import { createLocalStore } from "./localStore";

const EMPTY: AppUser[] = [];

/**
 * The users the pickers need (assignees, lead, who's logging). It is a cache of the backend's `/users/options`:
 * `refreshUsers()` fills it after sign-in, and again after the Users page changes someone.
 */
export const usersStore = createLocalStore<AppUser[]>(STORAGE_KEYS.users, EMPTY);

export { normalizeEmail };

export const findUserByEmail = (email: string) => usersStore.read().find((u) => u.email === normalizeEmail(email));

/** Reloads the user list from the backend. A failed reload keeps what is already cached. */
export async function refreshUsers(): Promise<void> {
  try {
    usersStore.write(await getUserOptions());
  } catch {
    // The pickers keep showing the last list.
  }
}
