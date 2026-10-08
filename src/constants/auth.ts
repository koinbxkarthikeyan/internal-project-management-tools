// Configuration for the login flow (not user data).

/** Only addresses ending in `@<ALLOWED_EMAIL_DOMAIN>` may sign in. */
export const ALLOWED_EMAIL_DOMAIN = "koinbx.com";

/** Length of the one-time code the backend emails to regular users. */
export const OTP_LENGTH = 6;

/**
 * Roles an Admin can give to a user. Admins can manage users. Anyone registered with access Enabled can use the
 * whole app; a registered user whose access is Disabled can only open "What are you working on? > My sprint / My Task".
 * (The Super Admin is created by the backend and can't be assigned.)
 */
/** The teams a user can belong to (the same list everywhere in user management). */
export const USER_TEAMS = ["Backend", "Frontend", "Mobile", "Design", "Marketing", "Blockchain"] as const;
export type UserTeam = (typeof USER_TEAMS)[number];

export const USER_ROLES = ["Admin", "User"] as const;

/** Where a successful sign-in lands. */
export const DEFAULT_REDIRECT = "/overview";

export const LOGIN_PATH = "/login";

// localStorage keys: the login (token + user) and the cached user list for the pickers.
export const STORAGE_KEYS = {
  users: "koinbx.users",
  session: "koinbx.session",
} as const;
