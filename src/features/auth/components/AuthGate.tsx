"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LOGIN_PATH } from "@/constants/auth";
import { MY_TASK_HREF, WORK_HREF } from "@/constants/work";
import { sessionStore } from "@/lib/auth/sessionStore";
import { refreshUsers } from "@/lib/auth/userStore";
import { getMe } from "@/services/authApi";
import { useAuth } from "../hooks/useAuth";

const isWorkPath = (pathname: string) => [WORK_HREF, MY_TASK_HREF].some((href) => pathname === href || pathname.startsWith(`${href}/`));

/**
 * Keeps the whole app behind the login:
 * - not signed in (or not a registered user): nothing is rendered and the visitor goes to the login page;
 * - signed in with access Disabled: only "What are you working on? > My sprint" and "My Task" are available, every other
 *   page redirects there;
 * - signed in with access Enabled: everything permitted is available.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status, restricted } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const blocked = restricted && !isWorkPath(pathname);

  // Once signed in: refresh who I am (role / access may have changed) and the user list for the pickers.
  useEffect(() => {
    if (status !== "signedIn") return;
    let cancelled = false;
    getMe().then(
      (me) => {
        const current = sessionStore.read();
        if (!cancelled && current && JSON.stringify(current.user) !== JSON.stringify(me)) sessionStore.write({ token: current.token, user: me });
      },
      () => undefined, // a 401 already signed the user out (see apiClient); other errors keep the saved login
    );
    void refreshUsers();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status === "signedOut") router.replace(LOGIN_PATH);
    else if (status === "signedIn" && blocked) router.replace(WORK_HREF);
  }, [status, blocked, router]);

  if (status !== "signedIn" || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Checking sign-in">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }
  return <>{children}</>;
}
