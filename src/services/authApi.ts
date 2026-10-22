import { DEFAULT_INITIAL_PASSWORD } from "@/constants/auth";
import { apiClient } from "@/lib/apiClient";
import { toAppUser, type ApiUser } from "@/lib/auth/userMapper";
import type { AppUser } from "@/types/auth";

export type SignInStep = { next: "PASSWORD" | "OTP"; resendInSeconds?: number; devCode?: string };
type TokenResponse = { accessToken: string; user: ApiUser };
export type Login = { token: string; user: AppUser };

const login = (data: TokenResponse): Login => ({ token: data.accessToken, user: toAppUser(data.user) });

/** Step 1: tells whether this email signs in with a password (admins) or an emailed code (users). */
export async function signIn(email: string): Promise<SignInStep> {
  const { data } = await apiClient.post<SignInStep>("/auth/sign-in", { email: email.trim().toLowerCase() });
  return data;
}

export async function signInWithPassword(email: string, password: string): Promise<Login> {
  const { data } = await apiClient.post<TokenResponse>("/auth/sign-in/password", { email: email.trim().toLowerCase(), password });
  const result = login(data);
  // Only after the backend has accepted the sign-in: signing in with the initial password means the account must choose its own now.
  // This is a flag on the signed-in user (never the password itself); it is cleared when the password has been changed (the session ends).
  return password === DEFAULT_INITIAL_PASSWORD ? { ...result, user: { ...result.user, mustChangePassword: true, usesInitialPassword: true } } : result;
}

export async function verifyOtp(email: string, code: string): Promise<Login> {
  const { data } = await apiClient.post<TokenResponse>("/auth/sign-in/otp/verify", { email: email.trim().toLowerCase(), code });
  return login(data);
}

export async function resendOtp(email: string): Promise<SignInStep> {
  const { data } = await apiClient.post<SignInStep>("/auth/sign-in/otp/resend", { email: email.trim().toLowerCase() });
  return data;
}

/** The signed-in user, as the backend sees them now (role and access can change while signed in). */
export async function getMe(): Promise<AppUser> {
  const { data } = await apiClient.get<ApiUser>("/auth/me");
  return toAppUser(data);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/change-password", { currentPassword, newPassword });
}
