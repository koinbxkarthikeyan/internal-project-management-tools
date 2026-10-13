export type AccessStatus = "Enabled" | "Disabled";
export type UserRole = "Super Admin" | "Admin" | "User";
/** Roles that can be given to someone. "Super Admin" is held by exactly one person and can't be assigned. */
export type AssignableRole = Exclude<UserRole, "Super Admin">;

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccessStatus;
  team?: string;
  /** The account must set its own password before using the app (only if the backend reports it). */
  mustChangePassword?: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

/** The signed-in login: the backend's access token plus who it belongs to. */
export type Session = {
  token: string;
  user: AppUser;
};
