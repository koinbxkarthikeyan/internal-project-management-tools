"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoutIcon, SettingsIcon } from "@/components/ui/icons";
import { LOGIN_PATH } from "@/constants/auth";
import { signOut } from "@/lib/auth/authService";
import { useAuth } from "../hooks/useAuth";

/** Who is signed in, and the Sign out button (sits at the bottom of the sidebar). */
export default function SignOutBlock() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  if (!user) return null;

  return (
    <div className="mt-auto border-t border-border pt-4">
      <Link href="/settings" title="Settings" className="block rounded-lg px-3 py-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </Link>
      <Link
        href="/settings"
        aria-current={pathname === "/settings" ? "page" : undefined}
        className={`mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent ${
          pathname === "/settings" ? "bg-accent-soft font-medium text-accent" : "text-muted"
        }`}
      >
        <SettingsIcon className="shrink-0" />
        Settings
      </Link>
      <button
        type="button"
        onClick={() => {
          signOut();
          router.replace(LOGIN_PATH);
        }}
        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <LogoutIcon className="shrink-0" />
        Sign out
      </button>
    </div>
  );
}
