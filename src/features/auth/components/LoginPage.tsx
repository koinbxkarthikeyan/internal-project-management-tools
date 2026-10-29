"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_DISABLED_PATH, DEFAULT_REDIRECT } from "@/constants/auth";
import { WORK_HREF } from "@/constants/work";
import { peekLoginHandoff, signOut, type DeniedReason, type StartLoginResult } from "@/lib/auth/authService";
import { useAuth } from "../hooks/useAuth";
import AccessNotGranted from "./AccessNotGranted";
import AuthShell from "./AuthShell";
import EmailStep from "./EmailStep";
import OtpStep from "./OtpStep";
import PasswordStep from "./PasswordStep";

type Step =
  | { kind: "email"; email: string }
  | { kind: "otp"; result: Extract<StartLoginResult, { ok: true }> }
  | { kind: "password"; email: string }
  | { kind: "denied"; email: string; reason: DeniedReason };

export default function LoginPage() {
  const router = useRouter();
  const { status, restricted, settingsOnly, disabledAdmin } = useAuth();
  // After a password change the email is already known: Admins go straight to the password, others see their email filled in.
  const [handoff] = useState(peekLoginHandoff);
  const [step, setStep] = useState<Step>(() =>
    handoff?.email && handoff.withPassword ? { kind: "password", email: handoff.email } : { kind: "email", email: handoff?.email ?? "" },
  );
  const notice = handoff?.notice ?? "";

  // Once signed in (just now, or already), go to Overview.
  useEffect(() => {
    // Enabled users land on Overview; users with access Disabled can only use My sprint.
    if (status !== "signedIn") return;
    // A Disabled Admin who just signed in is signed out again and told why.
    if (disabledAdmin) {
      signOut();
      router.replace(ACCOUNT_DISABLED_PATH);
      return;
    }
    router.replace(settingsOnly ? "/settings" : restricted ? WORK_HREF : DEFAULT_REDIRECT);
  }, [status, restricted, settingsOnly, disabledAdmin, router]);

  if (status === "loading" || status === "signedIn") {
    return (
      <AuthShell title={status === "signedIn" ? "Signing you in…" : "Loading…"}>
        <div className="h-24 animate-pulse rounded-xl bg-hover" role="status" aria-label="Loading" />
      </AuthShell>
    );
  }

  if (step.kind === "denied") {
    return <AccessNotGranted email={step.email} reason={step.reason} onUseAnotherEmail={() => setStep({ kind: "email", email: step.email })} />;
  }

  if (step.kind === "password") {
    return (
      <AuthShell title="Enter your password" description="Admins sign in with their email and password.">
        {notice && step.email === handoff?.email && (
          <p role="status" className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {notice}
          </p>
        )}
        <PasswordStep
          email={step.email}
          onChangeEmail={() => setStep({ kind: "email", email: step.email })}
        />
      </AuthShell>
    );
  }

  if (step.kind === "otp") {
    return (
      <AuthShell title="Enter your code" description="Check your inbox for the 6-digit code.">
        <OtpStep
          email={step.result.email}
          initialDemoCode={step.result.demoCode}
          initialResendAt={step.result.resendAvailableAt}
          onChangeEmail={() => setStep({ kind: "email", email: step.result.email })}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in" description="Enter your work email to continue.">
      {notice && (
        <p role="status" className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}
      <EmailStep initialEmail={step.email} onSent={(result) => setStep(result.next === "PASSWORD" ? { kind: "password", email: result.email } : { kind: "otp", result })}
        onDenied={(email, reason) => setStep({ kind: "denied", email, reason })}
      />
    </AuthShell>
  );
}
