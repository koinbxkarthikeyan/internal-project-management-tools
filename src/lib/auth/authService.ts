import { getErrorMessage, getErrorStatus } from "@/lib/apiClient";
import * as authApi from "@/services/authApi";
import type { AppUser } from "@/types/auth";
import { validateEmail } from "./emailRules";
import { clearSession, setSession } from "./sessionStore";
import { refreshUsers } from "./userStore";

export { validateEmail };

export type StartLoginResult =
  | { ok: true; email: string; next: "PASSWORD" | "OTP"; resendAvailableAt: number; demoCode?: string }
  | { ok: false; message: string; denied?: DeniedReason };

/** Why a sign-in was refused outright. */
export type DeniedReason = "not-registered";

// The backend answers 403 "This email is not registered. Ask an admin to add you." for an unknown address.
const NOT_REGISTERED = /not registered|isn't registered|no account/i;

/**
 * Step 1: the backend says whether this email signs in with a password (Super Admin, Admin) or an emailed code (users),
 * and sends the code in the second case. Only `@koinbx.com` addresses are sent.
 */
export async function startLogin(rawEmail: string): Promise<StartLoginResult> {
  const check = validateEmail(rawEmail);
  if (!check.ok) return check;
  try {
    const step = await authApi.signIn(check.email);
    return {
      ok: true,
      email: check.email,
      next: step.next,
      resendAvailableAt: Date.now() + (step.resendInSeconds ?? 30) * 1000,
      ...(step.devCode ? { demoCode: step.devCode } : {}),
    };
  } catch (err) {
    const message = getErrorMessage(err);
    const status = getErrorStatus(err);
    if (status === 404 || NOT_REGISTERED.test(message)) return { ok: false, message, denied: "not-registered" };
    return { ok: false, message };
  }
}

export type ResendResult = { ok: true; resendAvailableAt: number; demoCode?: string } | { ok: false; message: string; waitSeconds?: number };

/** Asks the backend for a new code. Sending again within 30 seconds is refused with the time left. */
export async function resendOtp(email: string): Promise<ResendResult> {
  try {
    const step = await authApi.resendOtp(email);
    return { ok: true, resendAvailableAt: Date.now() + (step.resendInSeconds ?? 30) * 1000, ...(step.devCode ? { demoCode: step.devCode } : {}) };
  } catch (err) {
    const message = getErrorMessage(err);
    const wait = getErrorStatus(err) === 429 ? Number(/(\d+)\s*s/i.exec(message)?.[1]) : NaN;
    return { ok: false, message, ...(wait > 0 ? { waitSeconds: wait } : {}) };
  }
}

export type CompleteLoginResult =
  | { ok: true; user: AppUser }
  | { ok: false; message: string; locked?: boolean; expired?: boolean };

function failure(err: unknown): CompleteLoginResult {
  const message = getErrorMessage(err);
  return { ok: false, message, locked: /too many|locked/i.test(message), expired: /expired|no code|request a new/i.test(message) };
}

async function finish(login: authApi.Login): Promise<CompleteLoginResult> {
  setSession({ token: login.token, user: login.user });
  await refreshUsers();
  return { ok: true, user: login.user };
}

/** Step 2 for users: the emailed code. The backend checks it (10 minutes, single use, 5 tries). */
export async function completeLogin(email: string, code: string): Promise<CompleteLoginResult> {
  try {
    return await finish(await authApi.verifyOtp(email, code));
  } catch (err) {
    return failure(err);
  }
}

/** Step 2 for Super Admin and Admin: email and password. */
export async function completePasswordLogin(email: string, password: string): Promise<CompleteLoginResult> {
  try {
    return await finish(await authApi.signInWithPassword(email, password));
  } catch (err) {
    return failure(err);
  }
}

/** Signing out is local: the token is dropped (the backend has no sign-out call). */
export function signOut() {
  clearSession();
}
