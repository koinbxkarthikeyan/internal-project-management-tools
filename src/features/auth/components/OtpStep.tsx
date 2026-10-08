"use client";

import { useEffect, useState, type FormEvent } from "react";
import { OTP_LENGTH } from "@/constants/auth";
import { completeLogin, resendOtp } from "@/lib/auth/authService";
import OtpInput from "./OtpInput";

type OtpStepProps = {
  email: string;
  /** The code itself, returned by the backend only while it runs in prototype mode (it does not send real email). */
  initialDemoCode?: string;
  initialResendAt: number;
  onChangeEmail: () => void;
};

const linkButton =
  "text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline focus-visible:outline-2 focus-visible:outline-accent";

export default function OtpStep({ email, initialDemoCode, initialResendAt, onChangeEmail }: OtpStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [demoCode, setDemoCode] = useState(initialDemoCode);
  const [resendAt, setResendAt] = useState(initialResendAt);
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Ticks once a second so the resend countdown stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const canResend = (secondsLeft === 0 || needsNewCode) && !resending;

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (verifying || code.length !== OTP_LENGTH) return;
    setVerifying(true);
    setError("");
    setNotice("");
    const result = await completeLogin(email, code);
    setVerifying(false);
    // On success the stored login state changes and the page redirects.
    if (result.ok) return;
    setError(result.message);
    if (result.locked || result.expired) setNeedsNewCode(true);
    setCode("");
  }

  async function handleResend() {
    if (!canResend) return;
    setResending(true);
    setError("");
    const result = await resendOtp(email);
    setResending(false);
    if (!result.ok) {
      // Asked too soon: the message says how long is left, so the countdown follows it.
      if (result.waitSeconds) setResendAt(Date.now() + result.waitSeconds * 1000);
      setNow(Date.now());
      return setError(result.message);
    }
    setDemoCode(result.demoCode);
    setResendAt(result.resendAvailableAt);
    setNow(Date.now());
    setNeedsNewCode(false);
    setCode("");
    setNotice("A new code has been sent.");
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        We sent a {OTP_LENGTH}-digit code to <strong className="break-all font-semibold text-foreground">{email}</strong>.
      </p>

      {demoCode && (
        <div role="note" className="rounded-xl border border-border bg-accent-soft px-4 py-3 text-sm">
          <p className="font-medium text-accent">Prototype mode</p>
          <p className="mt-0.5 text-muted">
            No email is sent in this prototype. Use this code:{" "}
            <span className="font-semibold tabular-nums tracking-widest text-foreground">{demoCode}</span>
          </p>
        </div>
      )}

      <OtpInput value={code} onChange={(v) => (setCode(v), setError(""))} disabled={verifying} invalid={!!error} />

      <div aria-live="polite" className="min-h-5 text-xs">
        {error ? (
          <p role="alert" className="text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : notice ? (
          <p className="text-emerald-600 dark:text-emerald-300">{notice}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={verifying || code.length !== OTP_LENGTH}
        className="h-11 w-full rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {verifying ? "Verifying…" : "Verify OTP"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={handleResend} disabled={!canResend} className={linkButton}>
          {resending ? "Sending…" : canResend ? "Resend OTP" : `Resend OTP in ${secondsLeft}s`}
        </button>
        <button type="button" onClick={onChangeEmail} className={linkButton}>
          Change email
        </button>
      </div>
    </form>
  );
}
