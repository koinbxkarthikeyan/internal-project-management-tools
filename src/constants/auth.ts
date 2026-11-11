// Configuration for the login flow (not user data).

/** Only addresses on one of these domains (matched exactly, the part after the last "@") may sign in or be added. The first is the one suggested and completed. */
export const ALLOWED_EMAIL_DOMAINS = ["koinbx.com", "koinbazar.com"] as const;
export const ALLOWED_EMAIL_DOMAIN = ALLOWED_EMAIL_DOMAINS[0];
/** The domains as text for messages: "@koinbx.com or @koinbazar.com" (and "@koinbx.com and @koinbazar.com"). */
export const ALLOWED_DOMAINS_TEXT = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or ");
export const ALLOWED_DOMAINS_AND_TEXT = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" and ");

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

export const LOGIN_PATH = "/";

/** Where a Disabled Admin is sent (after being signed out) instead of the application. */
export const ACCOUNT_DISABLED_PATH = "/access-disabled";

// localStorage keys: the login (token + user). `users` is only the name of a cache an earlier version kept; it is removed on sign-out.
export const STORAGE_KEYS = {
  users: "koinbx.users.v2",
  session: "koinbx.session",
} as const;
