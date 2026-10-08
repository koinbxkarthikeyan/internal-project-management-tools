"use client";

import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import type { DeniedReason } from "@/lib/auth/authService";
import AuthShell from "./AuthShell";

type AccessNotGrantedProps = {
  email: string;
  reason: DeniedReason;
  onUseAnotherEmail: () => void;
};

const DETAIL: Record<DeniedReason, string> = {
  "not-registered":
    "This email isn't registered for this application. Ask an administrator to add you, then sign in again.",
};

/** Shown when the backend does not know the email. They are not signed in and not redirected. */
export default function AccessNotGranted({ email, reason, onUseAnotherEmail }: AccessNotGrantedProps) {
  return (
    <AuthShell title="Access Not Granted">
      <div role="alert" className="flex flex-col gap-4">
        <p className="text-sm text-muted">{DETAIL[reason]}</p>
        <p className="break-all rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium">{email}</p>
        <button
          type="button"
          onClick={onUseAnotherEmail}
          className="h-11 w-full rounded-xl border border-border px-4 text-sm font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          Use a different @{ALLOWED_EMAIL_DOMAIN} email
        </button>
      </div>
    </AuthShell>
  );
}
