"use client";

import { ArrowRightIcon, MailIcon } from "@/components/ui/icons";
import { useState, type FormEvent } from "react";
import { EmailInput } from "@/components/ui/EmailInput";
import { Field } from "@/components/ui/FormControls";
import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import { validateEmail } from "@/lib/auth/emailRules";
import { startLogin, type DeniedReason, type StartLoginResult } from "@/lib/auth/authService";
import { FieldError } from "@/components/ui/FieldError";

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
  // Nothing is flagged when the page opens: the field is checked once the person has left it (clicked or tabbed outside
  // the form) or pressed Next, and from then on as they type, so the message goes as soon as the address is usable.
  const [touched, setTouched] = useState(false);
  const check = validateEmail(email);
  const problem = touched && !check.ok ? (email.trim() ? check.message : "Email is required.") : "";
  const message = error || problem;
  // Green only for a complete address (name@koinbx.com) that passes the check, not for a partly typed one.
  const complete = new RegExp(`^[^\\s@]+@${ALLOWED_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`, "i").test(email.trim());
  const valid = !message && check.ok && complete;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setTouched(true);
    if (!email.trim()) return;
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
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
      // Focus leaving the email field for somewhere outside this form (not the Next button or a link inside it).
      onBlur={(e) => {
        if (e.target instanceof HTMLInputElement && !e.currentTarget.contains(e.relatedTarget as Node | null)) setTouched(true);
      }}
    >
      <Field label="Work email" required>
        <EmailInput
          autoFocus
          leading={<MailIcon width={16} height={16} />}
          value={email}
          onChange={(v) => (setEmail(v), setError(""))}
          invalid={!!message}
          valid={valid}
          aria-describedby="email-help"
          className={`h-11 ${message ? "border-red-500" : ""}`}
          placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
        />
      </Field>
      {message ? (
        <FieldError id="email-help" className="-mt-2">
          {message}
        </FieldError>
      ) : (
        <p id="email-help" className="-mt-2 text-xs text-muted">
          Only @{ALLOWED_EMAIL_DOMAIN} email addresses can sign in.
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="h-11 w-full btn-brand inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {sending ? "Please wait…" : <>Next <ArrowRightIcon width={16} height={16} /></>}
      </button>
    </form>
  );
}
