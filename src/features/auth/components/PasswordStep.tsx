"use client";

import LoadingLabel from "./LoadingLabel";
import { ArrowRightIcon, LockIcon } from "@/components/ui/icons";
import { useState, type FormEvent } from "react";
import { DisabledTip } from "@/components/ui/DisabledTip";
import { PasswordField } from "@/components/ui/PasswordField";
import { completePasswordLogin } from "@/lib/auth/authService";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordRules";
import { FieldError } from "@/components/ui/FieldError";

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
  // A usability check only: Sign in waits for the minimum length; the backend still decides whether the password is right.
  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  // Nothing is flagged when the step opens: an empty password is reported once the person has left the field (clicked or
  // tabbed outside the form) or tried to continue, and the message goes as soon as something is typed.
  const [touched, setTouched] = useState(false);
  const message = error || (touched && password === "" ? "Password is required." : "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTouched(true);
    if (tooShort) return;
    setBusy(true);
    setError("");
    const result = await completePasswordLogin(email, password);
    setBusy(false);
    // On success the login page notices the new session and moves on.
    if (result.ok) return;
    setError(result.message);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
      // Focus leaving the password field for somewhere outside this form (not the show/hide button, Sign in or a link inside it).
      onBlur={(e) => {
        if (e.target instanceof HTMLInputElement && !e.currentTarget.contains(e.relatedTarget as Node | null)) setTouched(true);
      }}
      // Enter in an empty field can't submit (Sign in is disabled), so it is treated as trying to continue.
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement && password === "") setTouched(true);
      }}
    >
      <p className="text-sm text-muted">
        Signing in as <strong className="break-all font-semibold text-foreground">{email}</strong>.
      </p>
      <PasswordField
        label="Password"
        name="password"
        required
        autoFocus
        leading={<LockIcon width={16} height={16} />}
        autoComplete="current-password"
        value={password}
        onChange={(v) => (setPassword(v), setError(""))}
        invalid={!!message}
        valid={!message && !tooShort}
        inputClassName="h-11"
      />
      {message && (
        <FieldError className="-mt-2">
          {message}
        </FieldError>
      )}
      <DisabledTip reason={!busy && tooShort && `Enter your password (at least ${MIN_PASSWORD_LENGTH} characters) to sign in.`} className="block">
      <button
        type="submit"
        disabled={busy || tooShort}
        aria-busy={busy}
        className={`${busy ? "btn-loading " : ""}h-11 w-full btn-brand inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      >
        {busy ? <LoadingLabel>Signing in</LoadingLabel> : <>Sign in <ArrowRightIcon width={16} height={16} /></>}
      </button>
      </DisabledTip>
      <div className="flex justify-center">
        <button type="button" onClick={onChangeEmail} className={linkButton}>
          Use a different email
        </button>
      </div>
    </form>
  );
}
