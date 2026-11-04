"use client";

import { useEffect, useRef } from "react";
import { AlertCircleIcon } from "@/components/ui/icons";

/**
 * The popup shown on Settings while a password change is required. It has no close button, ignores Escape and a click outside, and the page
 * behind it cannot be used: the only way on is "Change Password", which opens the form below.
 */
export default function PasswordChangeNotice({ onContinue }: { onContinue: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="password-notice-title"
      aria-describedby="password-notice-text"
      onCancel={(e) => e.preventDefault()}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-modal backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400" aria-hidden="true">
            <AlertCircleIcon width={22} height={22} />
          </span>
          <h2 id="password-notice-title" className="text-base font-semibold">
            You must change your password
          </h2>
        </div>
        <p id="password-notice-text" className="text-sm leading-relaxed text-muted">
          We have set a common password for all users. For your account’s security, you must change this password.
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => {
            ref.current?.close();
            onContinue();
          }}
          className="btn-brand h-11 w-full rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Change Password
        </button>
      </div>
    </dialog>
  );
}
