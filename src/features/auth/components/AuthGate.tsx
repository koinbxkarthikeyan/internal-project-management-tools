"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LOGIN_PATH } from "@/constants/auth";
import { MY_TASK_HREF, WORK_HREF } from "@/constants/work";
import { sessionStore } from "@/lib/auth/sessionStore";
import { resetSharedData } from "@/lib/auth/authService";
import { refreshUsers } from "@/lib/auth/userStore";
import { getMe } from "@/services/authApi";
import ChangePasswordRequired from "./ChangePasswordRequired";
import { useAuth } from "../hooks/useAuth";

const isWorkPath = (pathname: string) => [WORK_HREF, MY_TASK_HREF, "/settings"].some((href) => pathname === href || pathname.startsWith(`${href}/`));

/**
 * Keeps the whole app behind the login:
 * - not signed in (or not a registered user): nothing is rendered and the visitor goes to the login page;
 * - signed in with access Disabled: only "What are you working on? > My sprint" and "My Task" are available, every other
 *   page redirects there;
 * - signed in with access Enabled: everything permitted is available.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status, restricted, settingsOnly, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // A normal User may only open My sprint, My Task and Settings; a Disabled account may not be in the app at all.
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
          if (current && JSON.stringify(current.user) !== JSON.stringify(me)) sessionStore.write({ token: current.token, user: me });
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
    if (status === "signedOut") {
      resetSharedData(); // also when the login simply expired (401), not only on Sign out
      router.replace(LOGIN_PATH);
    }
    else if (status === "signedIn" && blocked) router.replace(settingsOnly ? "/settings" : WORK_HREF);
  }, [status, blocked, settingsOnly, router]);

  if (status !== "signedIn" || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Checking sign-in">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }
  // The backend asked this account to choose its own password: nothing else is reachable until it has.
  if (user?.mustChangePassword) return <ChangePasswordRequired />;
  return <>{children}</>;
}
