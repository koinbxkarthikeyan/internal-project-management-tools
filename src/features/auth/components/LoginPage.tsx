"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_REDIRECT } from "@/constants/auth";
import { WORK_HREF } from "@/constants/work";
import type { DeniedReason, StartLoginResult } from "@/lib/auth/authService";
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
  const { status, restricted } = useAuth();
  const [step, setStep] = useState<Step>({ kind: "email", email: "" });

  // Once signed in (just now, or already), go to Overview.
  useEffect(() => {
    // Enabled users land on Overview; users with access Disabled can only use My sprint.
    if (status === "signedIn") router.replace(restricted ? WORK_HREF : DEFAULT_REDIRECT);
  }, [status, restricted, router]);

  if (status === "loading" || status === "signedIn") {
    return (
      <AuthShell title={status === "signedIn" ? "Signing you in…" : "Loading…"}>
        <div className="h-24 animate-pulse rounded-xl bg-hover" role="status" aria-label="Loading" />
      </AuthShell>
    );
  }

  if (step.kind === "denied") {
    return <AccessNotGranted email={step.email} reason={step.reason} onUseAnotherEmail={() => setStep({ kind: "email", email: "" })} />;
  }

  if (step.kind === "password") {
    return (
      <AuthShell title="Enter your password" description="Admins sign in with their email and password.">
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
      <EmailStep initialEmail={step.email} onSent={(result) => setStep(result.next === "PASSWORD" ? { kind: "password", email: result.email } : { kind: "otp", result })}
        onDenied={(email, reason) => setStep({ kind: "denied", email, reason })}
      />
    </AuthShell>
  );
}
