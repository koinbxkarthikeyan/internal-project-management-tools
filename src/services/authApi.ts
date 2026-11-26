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

/** The account is open on another computer: this sign-in waits there for Allow or Deny. `requestId` is the secret this computer asks with. */
export type SignInPending = { pending: true; requestId: string; initial: boolean };

// Only after the sign-in was accepted: signing in with the initial password means the account must choose its own now.
// This is a flag on the signed-in user (never the password itself); it is cleared when the password has been changed (the session ends).
const accepted = (data: TokenResponse, initial: boolean): Login => {
  const result = login(data);
  return initial ? { ...result, user: { ...result.user, mustChangePassword: true, usesInitialPassword: true } } : result;
};

export async function signInWithPassword(email: string, password: string): Promise<Login | SignInPending> {
  const { data } = await apiClient.post<TokenResponse | { pending: true; requestId: string }>("/auth/sign-in/password", { email: email.trim().toLowerCase(), password });
  const initial = password === DEFAULT_INITIAL_PASSWORD;
  return "pending" in data ? { pending: true, requestId: data.requestId, initial } : accepted(data, initial);
}

/** Asks whether the owner has answered: still waiting, denied or expired, or allowed (and then this computer is signed in). */
export async function checkSignInRequest(requestId: string, initial: boolean): Promise<{ status: "pending" | "denied" | "expired" } | { status: "allowed"; login: Login }> {
  const { data } = await apiClient.post<{ status: "pending" | "denied" | "expired" } | ({ status: "allowed" } & TokenResponse)>("/auth/sign-in/status", { requestId });
  return data.status === "allowed" ? { status: "allowed", login: accepted(data, initial) } : { status: data.status };
}

/** The waiting computer gives up: its request is taken back, so the owner is no longer asked about it. */
export async function withdrawSignInRequest(requestId: string): Promise<void> {
  await apiClient.post("/auth/sign-in/withdraw", { requestId });
}

/** A sign-in waiting on another computer, as the signed-in owner is shown it. */
export type SignInRequest = { id: string; at: string; ip: string; agent: string };

export async function listSignInRequests(): Promise<SignInRequest[]> {
  const { data } = await apiClient.post<{ items: SignInRequest[] }>("/auth/sign-in-requests/pending", {});
  return data.items;
}

/** The signed-in owner's answer to a waiting sign-in: Allow (true) or Deny (false). */
export async function answerSignInRequest(id: string, allow: boolean): Promise<void> {
  await apiClient.post("/auth/sign-in-requests/decide", { id, allow });
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
