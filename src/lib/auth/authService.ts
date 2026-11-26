import { apiClient, getErrorMessage, getErrorStatus } from "@/lib/apiClient";
import * as authApi from "@/services/authApi";
import type { AppUser } from "@/types/auth";
import { validateEmail } from "./emailRules";
import { clearSession, sessionStore, setSession } from "./sessionStore";
import { useBacklogStore } from "@/stores/backlogStore";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import { useMyTasksStore } from "@/stores/myTasksStore";
import { useUsersStore } from "@/stores/usersStore";
import { useWorkPickStore } from "@/stores/workPickStore";
import { useWorkStore } from "@/stores/workStore";
import { refreshUsers } from "./userStore";

export { validateEmail };

export type StartLoginResult = { ok: true; email: string } | { ok: false; message: string; denied?: DeniedReason };

/** Why a sign-in was refused outright. */
export type DeniedReason = "not-registered";

const NOT_REGISTERED = /not registered|isn't registered|no account/i;

/** Step 1: the email must belong to an account. Only `@koinbx.com` and `@koinbazar.com` addresses are accepted. */
export async function startLogin(rawEmail: string): Promise<StartLoginResult> {
  const check = validateEmail(rawEmail);
  if (!check.ok) return check;
  try {
    await authApi.signIn(check.email);
    return { ok: true, email: check.email };
  } catch (err) {
    const message = getErrorMessage(err);
    if (getErrorStatus(err) === 404 || NOT_REGISTERED.test(message)) return { ok: false, message, denied: "not-registered" };
    return { ok: false, message };
  }
}

export type CompleteLoginResult = { ok: true; user: AppUser } | { ok: false; message: string; locked?: boolean; /** The account is open on another computer: this sign-in waits there for Allow. */ waiting?: { requestId: string; initial: boolean } };

function failure(err: unknown): CompleteLoginResult {
  const message = getErrorMessage(err);
  return { ok: false, message, locked: /too many|locked/i.test(message) };
}

async function finish(login: authApi.Login): Promise<CompleteLoginResult> {
  handoff = null;
  setSession({ token: login.token, user: login.user });
  await refreshUsers(true);
  return { ok: true, user: login.user };
}

/** Step 2: email and password. */
export async function completePasswordLogin(email: string, password: string): Promise<CompleteLoginResult> {
  try {
    const login = await authApi.signInWithPassword(email, password);
    if ("pending" in login) return { ok: false, message: "", waiting: { requestId: login.requestId, initial: login.initial } };
    return await finish(login);
  } catch (err) {
    return failure(err);
  }
}

/** Gives up a held sign-in: the other computer is no longer asked about it. A failed call changes nothing (the request runs out by itself). */
export const withdrawSignIn = (requestId: string): void => void authApi.withdrawSignInRequest(requestId).catch(() => undefined);

/** Waits (asking every 2 seconds) until the account's owner answers a held sign-in: signed in on Allow, a message on Deny or when it runs out. Stops quietly when `signal` aborts. */
export async function awaitSignInApproval(requestId: string, initial: boolean, signal: AbortSignal): Promise<CompleteLoginResult> {
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, 2000));
    if (signal.aborted) break;
    try {
      const answer = await authApi.checkSignInRequest(requestId, initial);
      if (signal.aborted) break;
      if (answer.status === "allowed") return await finish(answer.login);
      if (answer.status === "denied") return { ok: false, message: "The sign-in was denied on your other computer." };
      if (answer.status === "expired") return { ok: false, message: "Nobody answered in time. Sign in again." };
    } catch (err) {
      return failure(err);
    }
  }
  return { ok: false, message: "" };
}

/** On an empty app: whether the first Super Admin still has to be created. A failed check means "no" (the normal sign-in is shown). */
export const needsSetup = () => authApi.getSetupStatus().catch(() => false);

/** Creates the first Super Admin and signs them in. */
export async function completeSetup(input: { name: string; email: string; password: string }): Promise<CompleteLoginResult> {
  try {
    return await finish(await authApi.createFirstAdmin(input));
  } catch (err) {
    return failure(err);
  }
}

/** Drops everything loaded for the signed-in person from the shared stores. */
export function resetSharedData() {
  useBacklogStore.setState({ scope: "", status: "loading", items: [], owners: [], sprints: [], pods: [], loadedAt: 0 });
  useWorkStore.setState({ scope: "", status: "loading", entries: [], loadedAt: 0 });
  useWorkPickStore.getState().setPicked(null);
  useUsersStore.getState().reset();
  useItemDetailStore.getState().clear();
  useMyTasksStore.getState().reset();
}

/** Signing out ends the session on the server (the cookie is cleared), drops the saved login and keeps nothing of this user in the shared screens. */
export function signOut() {
  void apiClient.post("/auth/sign-out").catch(() => undefined);
  clearSession();
  resetSharedData();
}

export const PASSWORD_CHANGED_NOTICE = "Password changed successfully. Please log in with your new password.";

/** What the login screen shows once after a password change: a message, and the email that was just signed in (never a token). */
export type LoginHandoff = { notice: string; email: string; withPassword: boolean };
let handoff: LoginHandoff | null = null;

/** Read by the login screen (it can mount more than once while signing out); it lives in memory, so a reload drops it, and a completed sign-in clears it. */
export const peekLoginHandoff = (): LoginHandoff | null => handoff;

/**
 * After a new password was saved: sign out like the Sign out button does (token, session and cached data are
 * cleared) and leave a handoff for the login page. Admins sign in with a password, so the password step is offered
 * directly for the email they were using; everyone else gets the email step with their email filled in.
 */
export function signOutAfterPasswordChange() {
  const user = sessionStore.read()?.user;
  handoff = user ? { notice: PASSWORD_CHANGED_NOTICE, email: user.email, withPassword: true } : { notice: PASSWORD_CHANGED_NOTICE, email: "", withPassword: false };
  signOut();
}
