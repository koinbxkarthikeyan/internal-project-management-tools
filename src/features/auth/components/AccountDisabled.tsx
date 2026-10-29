"use client";

import Link from "next/link";
import { LOGIN_PATH } from "@/constants/auth";
import AuthShell from "./AuthShell";

/** Shown to an Admin whose account is disabled, after they have been signed out. It holds no application data and no navigation. */
export default function AccountDisabled() {
  return (
    <AuthShell title="Account disabled">
      <div role="alert" className="flex flex-col gap-4">
        <p className="text-sm text-muted">Your account is disabled. Please contact your administrator.</p>
        <Link
          href={LOGIN_PATH}
          className="flex h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          Return to login
        </Link>
      </div>
    </AuthShell>
  );
}
