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
/** The teams that are always offered; any other team is added by typing it in the user form (see lib/auth/teams.ts). */
export const DEFAULT_TEAMS: readonly string[] = ["Backend", "Frontend", "Mobile", "Design", "Marketing", "Blockchain"];
/** Pre-filled in the Add Team Member form (User and Admin); an Admin can change it before creating the account. */
export const DEFAULT_INITIAL_PASSWORD = "Koinbx@01";
export const TEAM_MAX_LENGTH = 50;

export const USER_ROLES = ["Admin", "User"] as const;

/** Where a successful sign-in lands. */
export const DEFAULT_REDIRECT = "/overview";

export const LOGIN_PATH = "/login";

// localStorage keys: the login (token + user). `users` is only the name of a cache an earlier version kept; it is removed on sign-out.
export const STORAGE_KEYS = {
  users: "koinbx.users.v2",
  session: "koinbx.session",
} as const;
