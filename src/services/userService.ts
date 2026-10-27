import { apiClient } from "@/lib/apiClient";
import { accessToApi, roleToApi, teamToApi, toAppUser, type ApiUser } from "@/lib/auth/userMapper";
import type { AccessStatus, AppUser, AssignableRole } from "@/types/auth";

/** Everyone, for the pickers (assignees, lead, who's logging). Any signed-in user may call it. */
export async function getUserOptions(): Promise<AppUser[]> {
  const { data } = await apiClient.get<ApiUser[]>("/users/options");
  return data.map(toAppUser);
}

/** The Users page (Admins). Includes the last sign-in time. */
export async function getUsers(): Promise<AppUser[]> {
  const { data } = await apiClient.get<ApiUser[]>("/users");
  return data.map(toAppUser);
}

export type NewUser = { name: string; email: string; role: AssignableRole; status: AccessStatus; team?: string; password?: string };

/** The request body for a new user: exactly what `createUser` sends. */
export const newUserBody = (input: NewUser) => ({
  name: input.name,
  email: input.email.trim().toLowerCase(),
  role: roleToApi(input.role),
  accessStatus: accessToApi(input.status),
  ...(input.team ? { team: teamToApi(input.team) } : {}),
  ...(input.password ? { password: input.password } : {}),
});

export async function createUser(input: NewUser): Promise<AppUser> {
  const { data } = await apiClient.post<ApiUser>("/users", newUserBody(input));
  return toAppUser(data);
}

export type UserPatch = { name?: string; email?: string; role?: AssignableRole; status?: AccessStatus; team?: string | null; password?: string };

export async function updateUser(id: string, patch: UserPatch): Promise<AppUser> {
  const { data } = await apiClient.patch<ApiUser>(`/users/${encodeURIComponent(id)}`, {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
    ...(patch.role ? { role: roleToApi(patch.role) } : {}),
    ...(patch.status ? { accessStatus: accessToApi(patch.status) } : {}),
    ...(patch.team !== undefined ? { team: patch.team ? teamToApi(patch.team) : null } : {}),
    ...(patch.password ? { password: patch.password } : {}),
  });
  return toAppUser(data);
}

export async function setUserAccess(id: string, status: AccessStatus): Promise<AppUser> {
  const { data } = await apiClient.patch<ApiUser>(`/users/${encodeURIComponent(id)}/access`, { accessStatus: accessToApi(status) });
  return toAppUser(data);
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${encodeURIComponent(id)}`);
}
