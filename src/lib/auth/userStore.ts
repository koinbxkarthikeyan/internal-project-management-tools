import { useUsersStore } from "@/stores/usersStore";
import type { AppUser } from "@/types/auth";
import { normalizeEmail } from "./emailRules";

/**
 * Plain-function access to the shared users (src/stores/usersStore.ts) for code that isn't a component: the service
 * mappers, form validation and the sign-in flow.
 */
export const usersStore = {
  /** The users the pickers need (assignees, lead, who's logging). */
  read: (): AppUser[] => useUsersStore.getState().options,
};

export { normalizeEmail };

export const findUserByEmail = (email: string) => usersStore.read().find((u) => u.email.toLowerCase() === normalizeEmail(email));

/** Uses a user list another call already read, so the pickers don't ask again. */
export const primeUsers = (list: AppUser[]): void => useUsersStore.getState().setOptions(list);

/**
 * Loads the pickers' users. Several callers at once share one request, and a list read in the last minute is reused;
 * pass `force` after a change to the users so the new list is read at once.
 */
export const refreshUsers = (force = false): Promise<void> => useUsersStore.getState().loadOptions(force);
