"use client";

import { useState, type FormEvent } from "react";
import { EmailInput } from "@/components/ui/EmailInput";
import { Field } from "@/components/ui/FormControls";
import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import { startLogin, type DeniedReason, type StartLoginResult } from "@/lib/auth/authService";

type EmailStepProps = {
  initialEmail?: string;
  onSent: (result: Extract<StartLoginResult, { ok: true }>) => void;
  /** The backend doesn't know this email. */
  onDenied?: (email: string, reason: DeniedReason) => void;
};

export default function EmailStep({ initialEmail = "", onSent, onDenied }: EmailStepProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    const result = await startLogin(email);
    if (result.ok) setEmail(result.email);
    setSending(false);
    if (result.ok) onSent(result);
    else if (result.denied && onDenied) onDenied(email, result.denied);
    else setError(result.message);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Work email" required>
        <EmailInput
          autoFocus
          value={email}
          onChange={(v) => (setEmail(v), setError(""))}
          invalid={!!error}
          aria-describedby="email-help"
          className={`h-11 ${error ? "border-red-500" : ""}`}
          placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
        />
      </Field>
      {error ? (
        <p id="email-help" role="alert" className="-mt-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : (
        <p id="email-help" className="-mt-2 text-xs text-muted">
          Only @{ALLOWED_EMAIL_DOMAIN} email addresses can sign in.
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="h-11 w-full rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {sending ? "Please wait…" : "Next"}
      </button>
    </form>
  );
}
