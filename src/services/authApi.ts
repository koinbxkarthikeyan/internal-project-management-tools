import { DEFAULT_INITIAL_PASSWORD } from "@/constants/auth";
import { apiClient } from "@/lib/apiClient";
import { toAppUser, type ApiUser } from "@/lib/auth/userMapper";
import type { AppUser } from "@/types/auth";

export type SignInStep = { next: "PASSWORD" };
type TokenResponse = { accessToken: string; user: ApiUser };
export type Login = { token: string; user: AppUser };

const login = (data: TokenResponse): Login => ({ token: data.accessToken, user: toAppUser(data.user) });

/** Step 1: checks that this email has an account (everyone signs in with a password). */
export async function signIn(email: string): Promise<SignInStep> {
  const { data } = await apiClient.post<SignInStep>("/auth/sign-in", { email: email.trim().toLowerCase() });
  return data;
}

export async function signInWithPassword(email: string, password: string): Promise<Login> {
  const { data } = await apiClient.post<TokenResponse>("/auth/sign-in/password", { email: email.trim().toLowerCase(), password });
  const result = login(data);
  // Only after the sign-in was accepted: signing in with the initial password means the account must choose its own now.
  // This is a flag on the signed-in user (never the password itself); it is cleared when the password has been changed (the session ends).
  return password === DEFAULT_INITIAL_PASSWORD ? { ...result, user: { ...result.user, mustChangePassword: true, usesInitialPassword: true } } : result;
}

/** Whether the app is empty, so the first Super Admin has to be created. */
export async function getSetupStatus(): Promise<boolean> {
  const { data } = await apiClient.get<{ needed: boolean }>("/auth/setup-status");
  return data.needed;
}

/** Creates the first account, a Super Admin, on an empty app, and signs it in. */
export async function createFirstAdmin(input: { name: string; email: string; password: string }): Promise<Login> {
  const { data } = await apiClient.post<TokenResponse>("/auth/setup", { name: input.name, email: input.email.trim().toLowerCase(), password: input.password });
  return login(data);
}

/** The signed-in user as the data holds them now (role and access can change while signed in). */
export async function getMe(): Promise<AppUser> {
  const { data } = await apiClient.get<ApiUser>("/auth/me");
  return toAppUser(data);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/change-password", { currentPassword, newPassword });
}
