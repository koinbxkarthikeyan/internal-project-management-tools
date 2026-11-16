"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";

/** Next to the bell: opens the keyboard shortcuts list (the same as pressing ?), so the shortcuts can be found without knowing the key. Shown where there is a keyboard. */
export default function ShortcutsButton() {
  const { user, settingsOnly } = useAuth();
  if (!user || settingsOnly) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-shortcuts"))}
      aria-label="Keyboard shortcuts"
      aria-keyshortcuts="?"
      title="Keyboard shortcuts (press ?)"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
        <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7 14h10" />
      </svg>
    </button>
  );
}
