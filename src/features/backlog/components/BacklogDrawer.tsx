"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DisabledTip } from "@/components/ui/DisabledTip";
import { useToast } from "@/components/ui/Toast";
import { checkRequiredFields, clearFilled } from "@/lib/formValidation";

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
  /** Edit forms pass `false` until something differs from the saved data, which keeps the submit button disabled. */
  canSubmit?: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Right-hand slide-over panel (native <dialog>) shared by the Create and Edit backlog forms. */
export default function BacklogDrawer({ heading, submitLabel, onSubmit, onClose, compact = false, danger = false, viewOnly = false, canSubmit = true, children }: BacklogDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
    // A panel opened from inside another panel's form (e.g. Add Owner in a backlog form) must not submit or close its parent.
    e.stopPropagation();
    if (saving) return;
    // Required fields first: if any is empty the panel stays open and says which ones.
    if (!viewOnly && !checkRequiredFields(e.currentTarget as HTMLFormElement, toast.show)) return;
    setSaving(true);
    const result = await onSubmit();
    setSaving(false);
    if (result === false) return;
    requestClose();
  }

  return (
    <dialog
      ref={ref}
      // React passes a dialog's "close" and "cancel" events up to the panel it is nested in (Add Owner inside a backlog
      // form), so each panel only reacts to its own.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        // Escape: animate out instead of closing instantly.
        e.preventDefault();
        if (e.target === e.currentTarget) requestClose();
      }}
      data-closing={closing || undefined}
      onClick={(e) => e.target === ref.current && requestClose()}
      aria-label="Backlog item"
      className={`drawer fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-dvh w-full ${compact ? "max-w-md" : expanded ? "max-w-none" : "max-w-3xl"} border-l border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50`}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        // A field that was marked missing loses its red mark once it has a value.
        onInput={(e) => clearFilled(e.currentTarget)}
        onClickCapture={(e) => {
          const form = e.currentTarget;
          requestAnimationFrame(() => clearFilled(form));
        }}
        className="flex h-full flex-col"
      >
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
          <DisabledTip reason={!saving && !canSubmit && "No changes to save."} className="inline-block">
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className={`h-10 rounded-lg px-4 text-sm font-medium transition-opacity ${danger ? "bg-red-600 text-white" : "btn-brand font-semibold"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed `}
          >
            {saving ? "Saving…" : submitLabel}
          </button>
          </DisabledTip>
          )}
        </footer>
      </form>
    </dialog>
  );
}
