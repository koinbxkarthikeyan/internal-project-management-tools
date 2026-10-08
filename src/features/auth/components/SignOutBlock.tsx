"use client";

import { useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/ui/icons";
import { LOGIN_PATH } from "@/constants/auth";
import { signOut } from "@/lib/auth/authService";
import { useAuth } from "../hooks/useAuth";

/** Who is signed in, and the Sign out button (sits at the bottom of the sidebar). */
export default function SignOutBlock() {
  const { user } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <div className="mt-auto border-t border-border pt-4">
      <p className="truncate px-3 text-sm font-medium">{user.name}</p>
      <p className="truncate px-3 text-xs text-muted">{user.email}</p>
      <button
        type="button"
        onClick={() => {
          signOut();
          router.replace(LOGIN_PATH);
        }}
        className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <LogoutIcon className="shrink-0" />
        Sign out
      </button>
    </div>
  );
}
