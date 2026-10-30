"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ACCOUNT_DISABLED_PATH, LOGIN_PATH } from "@/constants/auth";
import { MY_TASK_HREF, OVERVIEW_HREF, WORK_HREF } from "@/constants/work";
import { sessionStore } from "@/lib/auth/sessionStore";
import { resetSharedData, signOut } from "@/lib/auth/authService";
import { refreshUsers } from "@/lib/auth/userStore";
import { getMe } from "@/services/authApi";
import { useAuth } from "../hooks/useAuth";

const isWorkPath = (pathname: string) => [OVERVIEW_HREF, WORK_HREF, MY_TASK_HREF, "/settings"].some((href) => pathname === href || pathname.startsWith(`${href}/`));

/**
 * Keeps the whole app behind the login:
 * - not signed in (or not a registered user): nothing is rendered and the visitor goes to the login page;
 * - signed in but the backend says the account must choose its own password (`mustChangePassword`): only Settings is reachable (settingsOnly),
 *   whatever the URL, until the change succeeds;
 * - an Admin with access Disabled: signed out and sent to the account-disabled page;
 * - a normal User with access Disabled: only Settings is available, every other page redirects there;
 * - signed in with access Enabled: everything permitted is available.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status, restricted, settingsOnly, disabledAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // A normal User may only open Overview (their own), My sprint, My Task and Settings; a Disabled account may not be in the app at all.
  const onSettings = pathname === "/settings" || pathname.startsWith("/settings/");
  const blocked = settingsOnly ? !onSettings : restricted && !isWorkPath(pathname);

  // Once signed in: refresh who I am (role / access may have changed) and the user list for the pickers. It is checked again
  // whenever the tab comes back into view (at most once a minute), so a change made by an administrator takes effect.
  useEffect(() => {
    if (status !== "signedIn") return;
    let cancelled = false;
    let last = 0;
    const sync = () => {
      last = Date.now();
      getMe().then(
        (me) => {
          if (cancelled) return;
          const current = sessionStore.read();
          // A required password change raised at sign-in (initial password) stays until the password has changed, even if the server does not report it.
          const user = current?.user.mustChangePassword && !me.mustChangePassword ? { ...me, mustChangePassword: true, ...(current.user.usesInitialPassword ? { usesInitialPassword: true } : {}) } : me;
          if (current && JSON.stringify(current.user) !== JSON.stringify(user)) sessionStore.write({ token: current.token, user });
        },
        () => undefined, // a 401 already signed the user out (see apiClient); other errors keep the saved login
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 60_000) sync();
    };
    sync();
    void refreshUsers();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);

  useEffect(() => {
    // A Disabled Admin never sees the application: the saved login is dropped and they are told why (also when it was switched off while they were signed in).
    if (status === "signedIn" && disabledAdmin) {
      signOut();
      router.replace(ACCOUNT_DISABLED_PATH);
      return;
    }
    if (status === "signedOut") {
      resetSharedData(); // also when the login simply expired (401), not only on Sign out
      router.replace(LOGIN_PATH);
    }
    else if (status === "signedIn" && blocked) router.replace(settingsOnly ? "/settings" : WORK_HREF);
  }, [status, blocked, settingsOnly, disabledAdmin, router]);

  if (status !== "signedIn" || blocked || disabledAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Checking sign-in">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }
  return <>{children}</>;
}
