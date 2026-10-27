import { cleanTeam, canonicalTeam } from "./teams";
import { DEFAULT_TEAMS } from "@/constants/auth";
import type { AccessStatus, AppUser, UserRole } from "@/types/auth";

/** A user as the backend returns it (`/auth/me`, `/users`, `/users/options`). */
export type ApiUser = {
  id: number | string;
  name: string;
  email: string;
  role?: string;
  team?: string | null;
  /** Set by the backend, when it supports it, for an account that must choose its own password first. */
  mustChangePassword?: boolean;
  accessStatus?: string;
  lastSignInAt?: string | null;
  createdAt?: string;
};

const ROLE_FROM_API: Record<string, UserRole> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", USER: "User" };
export const roleToApi = (role: UserRole): string => role.toUpperCase().replace(" ", "_");

/** A team is saved as the name that was typed or picked (any team, not only the defaults). */
export const teamToApi = (team: string): string => cleanTeam(team);
/** Older records may hold the default teams in capitals ("BACKEND"); those read back as the usual spelling. */
const teamFromApi = (raw?: string | null): string | undefined => {
  const name = cleanTeam(String(raw ?? ""));
  return name ? canonicalTeam(name, DEFAULT_TEAMS) : undefined;
};

// Only the fields listed here are copied, so a password or hash is never kept even if a response carried one.
export function toAppUser(raw: ApiUser): AppUser {
  return {
    id: String(raw.id),
    name: raw.name,
    email: String(raw.email).toLowerCase(),
    role: ROLE_FROM_API[String(raw.role ?? "USER").toUpperCase()] ?? "User",
    status: String(raw.accessStatus ?? "ENABLED").toUpperCase() === "DISABLED" ? "Disabled" : "Enabled",
    ...(raw.mustChangePassword === true ? { mustChangePassword: true } : {}),
    ...(teamFromApi(raw.team) ? { team: teamFromApi(raw.team) } : {}),
    createdAt: raw.createdAt ?? "",
    ...(raw.lastSignInAt ? { lastLoginAt: raw.lastSignInAt } : {}),
  };
}

export const accessToApi = (status: AccessStatus) => (status === "Disabled" ? "DISABLED" : "ENABLED");
