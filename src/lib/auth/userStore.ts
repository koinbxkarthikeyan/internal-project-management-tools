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

/** Uses a user list another call already read (the Users page reads `/users`), so the pickers don't ask again. */
export function primeUsers(list: AppUser[]): void {
  usersStore.write(list);
  loadedAt = Date.now();
}

const FRESH_MS = 30_000;
let loadedAt = 0;
let inflight: Promise<void> | null = null;

/**
 * Reloads the user list from the backend. Several callers at once share one request, and a list read in the last few
 * seconds is reused; pass `force` after a change to the users so the new list is read at once. A failed reload keeps
 * what is already cached.
 */
export function refreshUsers(force = false): Promise<void> {
  if (!force && usersStore.read().length > 0 && Date.now() - loadedAt < FRESH_MS) return Promise.resolve();
  if (inflight) return inflight;
  inflight = getUserOptions()
    .then((list) => {
      usersStore.write(list);
      loadedAt = Date.now();
    })
    .catch(() => {
      // The pickers keep showing the last list.
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
