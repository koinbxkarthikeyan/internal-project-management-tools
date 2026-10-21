"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { LOGIN_PATH } from "@/constants/auth";
import { getErrorMessage } from "@/lib/apiClient";
import { signOut, signOutAfterPasswordChange } from "@/lib/auth/authService";
import { checkNewPassword } from "@/lib/auth/passwordRules";
import { changePassword } from "@/services/authApi";
import AuthShell from "./AuthShell";
import { FieldError } from "@/components/ui/FieldError";

/**
 * Shown instead of the app while the backend says the account must choose its own password (`mustChangePassword`).
 * Nothing else is reachable until the backend confirms the change; the flag is only cleared from what `/auth/me` says.
 */
export default function ChangePasswordRequired() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!current) return setError("Enter the password you were given.");
    const problem = checkNewPassword(next);
    if (problem) return setError(problem);
    if (next === current) return setError("Choose a password different from the one you were given.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await changePassword(current, next);
      signOutAfterPasswordChange();
      router.replace(LOGIN_PATH);
      return;
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Choose a new password" description="Your account was created with a temporary password. Set your own to continue.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <PasswordField label="Current password" required autoComplete="current-password" value={current} onChange={(v) => (setCurrent(v), setError(""))} />
        <PasswordField label="New password" required value={next} onChange={(v) => (setNext(v), setError(""))} placeholder="At least 8 characters" />
        <PasswordField label="Confirm new password" required value={confirm} onChange={(v) => (setConfirm(v), setError(""))} />
        {error && (
          <FieldError>
            {error}
          </FieldError>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full btn-brand inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {busy ? "Please wait…" : "Change password"}
        </button>
        <button
          type="button"
          onClick={() => (signOut(), router.replace(LOGIN_PATH))}
          className="text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Sign out
        </button>
      </form>
    </AuthShell>
  );
}
