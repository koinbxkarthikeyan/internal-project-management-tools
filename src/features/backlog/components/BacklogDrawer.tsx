"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type BacklogDrawerProps = {
  /** Left side of the header. */
  heading: ReactNode;
  submitLabel: string;
  /** Return `false` to keep the panel open (e.g. validation failed). */
  onSubmit: () => void | boolean | Promise<void | boolean>;
  /** Narrow panel without the Expand toggle, for short forms. */
  compact?: boolean;
  /** Styles the submit button as a destructive action (used by delete confirmations). */
  danger?: boolean;
  /** Details only: the footer has just a Close button (no submit). */
  viewOnly?: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Right-hand slide-over panel (native <dialog>) shared by the Create and Edit backlog forms. */
export default function BacklogDrawer({ heading, submitLabel, onSubmit, onClose, compact = false, danger = false, viewOnly = false, children }: BacklogDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Plays the slide-out, then closes the native dialog (which triggers onClose / unmount).
  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => ref.current?.close(), 200);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await onSubmit();
    setSaving(false);
    if (result === false) return;
    requestClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        // Escape: animate out instead of closing instantly.
        e.preventDefault();
        requestClose();
      }}
      data-closing={closing || undefined}
      onClick={(e) => e.target === ref.current && requestClose()}
      aria-label="Backlog item"
      className={`drawer fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-dvh w-full ${compact ? "max-w-md" : expanded ? "max-w-none" : "max-w-3xl"} border-l border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50`}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0 text-sm font-semibold">{heading}</div>
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-pressed={expanded}
            className={`hidden rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent ${compact ? "" : "sm:block"}`}
          >
            {expanded ? "Shrink" : "Expand"}
          </button>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            Close
          </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">{children}</div>

        <footer className="flex justify-end gap-2 border-t border-border px-6 py-3">
          <button
            type="button"
            onClick={requestClose}
            className="h-10 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            {viewOnly ? "Close" : "Cancel"}
          </button>
          {!viewOnly && (
          <button
            type="submit"
            disabled={saving}
            className={`h-10 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 ${danger ? "bg-red-600 text-white" : "bg-accent text-accent-foreground"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60`}
          >
            {saving ? "Saving…" : submitLabel}
          </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
