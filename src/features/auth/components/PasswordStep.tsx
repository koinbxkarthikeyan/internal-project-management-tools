"use client";

import { useState, type FormEvent } from "react";
import { Field, controlClass } from "@/components/ui/FormControls";
import { completePasswordLogin } from "@/lib/auth/authService";

type PasswordStepProps = {
  email: string;
  onChangeEmail: () => void;
};

const linkButton =
  "text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent";

/** Password sign-in for Super Admin and Admin (no one-time code). */
export default function PasswordStep({ email, onChangeEmail }: PasswordStepProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError("");
    const result = await completePasswordLogin(email, password);
    setBusy(false);
    // On success the login page notices the new session and moves on.
    if (result.ok) return;
    setError(result.message);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Signing in as <strong className="break-all font-semibold text-foreground">{email}</strong>.
      </p>
      <Field label="Password" required>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => (setPassword(e.target.value), setError(""))}
          aria-invalid={!!error || undefined}
          className={`${controlClass} h-11 ${error ? "border-red-500" : ""}`}
        />
      </Field>
      {error && (
        <p role="alert" className="-mt-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="flex justify-center">
        <button type="button" onClick={onChangeEmail} className={linkButton}>
          Use a different email
        </button>
      </div>
    </form>
  );
}
