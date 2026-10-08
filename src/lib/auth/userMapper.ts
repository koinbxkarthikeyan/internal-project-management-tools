import { USER_TEAMS, type UserTeam } from "@/constants/auth";
import type { AccessStatus, AppUser, UserRole } from "@/types/auth";

/** A user as the backend returns it (`/auth/me`, `/users`, `/users/options`). */
export type ApiUser = {
  id: number | string;
  name: string;
  email: string;
  role?: string;
  team?: string | null;
  accessStatus?: string;
  lastSignInAt?: string | null;
  createdAt?: string;
};

const ROLE_FROM_API: Record<string, UserRole> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", USER: "User" };
export const roleToApi = (role: UserRole): string => role.toUpperCase().replace(" ", "_");

export const teamToApi = (team: UserTeam): string => team.toUpperCase();
const teamFromApi = (raw?: string | null): UserTeam | undefined => USER_TEAMS.find((t) => t.toUpperCase() === String(raw ?? "").trim().toUpperCase());

export function toAppUser(raw: ApiUser): AppUser {
  return {
    id: String(raw.id),
    name: raw.name,
    email: String(raw.email).toLowerCase(),
    role: ROLE_FROM_API[String(raw.role ?? "USER").toUpperCase()] ?? "User",
    status: String(raw.accessStatus ?? "ENABLED").toUpperCase() === "DISABLED" ? "Disabled" : "Enabled",
    ...(teamFromApi(raw.team) ? { team: teamFromApi(raw.team) } : {}),
    createdAt: raw.createdAt ?? "",
    ...(raw.lastSignInAt ? { lastLoginAt: raw.lastSignInAt } : {}),
  };
}

export const accessToApi = (status: AccessStatus) => (status === "Disabled" ? "DISABLED" : "ENABLED");
