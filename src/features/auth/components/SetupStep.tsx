"use client";

import LoadingLabel from "./LoadingLabel";
import { ArrowRightIcon, LockIcon, MailIcon } from "@/components/ui/icons";
import { useState, type FormEvent } from "react";
import { EmailInput } from "@/components/ui/EmailInput";
import { FieldError } from "@/components/ui/FieldError";
import { Field, TextField } from "@/components/ui/FormControls";
import { PasswordField } from "@/components/ui/PasswordField";
import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import { completeSetup, validateEmail } from "@/lib/auth/authService";
import { checkNewPassword } from "@/lib/auth/passwordRules";

/** First run only: the app has no accounts yet, so the first one, a Super Admin, is created here. */
export default function SetupStep() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const emailCheck = validateEmail(email);
  const problem =
    !name.trim() ? "Enter your name." : !emailCheck.ok ? emailCheck.message : checkNewPassword(password) || (password !== confirm ? "The two passwords don't match." : "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    if (problem || !emailCheck.ok) return;
    setBusy(true);
    setError("");
    const result = await completeSetup({ name: name.trim(), email: emailCheck.email, password });
    setBusy(false);
    // On success the login page notices the new session and moves on.
    if (!result.ok) setError(result.message);
  }

  const message = error || (tried ? problem : "");
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <TextField label="Your name" required value={name} onChange={(v) => (setName(v), setError(""))} placeholder="Full name" />
      <Field label="Work email" required>
        <EmailInput showError={false} leading={<MailIcon width={16} height={16} />} value={email} onChange={(v) => (setEmail(v), setError(""))} className="h-11" placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`} />
      </Field>
      <PasswordField label="Password" name="new-password" required leading={<LockIcon width={16} height={16} />} value={password} onChange={(v) => (setPassword(v), setError(""))} inputClassName="h-11" />
      <PasswordField label="Confirm password" name="confirm-password" required leading={<LockIcon width={16} height={16} />} value={confirm} onChange={(v) => (setConfirm(v), setError(""))} inputClassName="h-11" />
      {message && <FieldError className="-mt-2">{message}</FieldError>}
      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className={`${busy ? "btn-loading " : ""}h-11 w-full btn-brand inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      >
        {busy ? <LoadingLabel>Creating</LoadingLabel> : <>Create Super Admin <ArrowRightIcon width={16} height={16} /></>}
      </button>
    </form>
  );
}
