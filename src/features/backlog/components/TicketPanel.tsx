"use client";

import { useEffect, useRef, useState } from "react";
import type { BacklogItemData } from "@/types/backlog";
import { TicketFormFields, useTicketForm } from "./TicketForm";

/**
 * The new-Ticket form as a compact panel at the top of a task's comment section (it floats over the conversation, which stays where it is, and is separate from the message box).
 * Create Ticket saves it and closes the panel; Cancel or Escape closes it without saving.
 */
export default function TicketPanel({ task, onClose, onCreated }: { task: BacklogItemData; onClose: () => void; onCreated: (ticket: BacklogItemData) => void }) {
  const form = useTicketForm(task, onCreated);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" });
    ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <>
      {/* The conversation stays behind, dimmed, so the form stands out from it. */}
      <div aria-hidden="true" className="absolute inset-0 z-10 rounded-2xl bg-foreground/10 backdrop-blur-[1px]" />
      <form
        ref={ref}
        aria-label="Create Ticket"
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving || !form.canSubmit) return;
          setSaving(true);
          const ok = await form.submit();
          setSaving(false);
          if (ok === false) return;
        }}
        className="anim-menu-in absolute inset-x-3 top-3 z-20 flex max-h-[min(36rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl border border-accent/40 bg-surface shadow-modal ring-4 ring-accent/10"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border bg-accent-soft/50 px-4 py-2.5">
          <p className="text-sm font-semibold">Create Ticket <span className="font-normal text-muted">· under {task.id}</span></p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-lg text-lg leading-none text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">×</button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <TicketFormFields task={task} form={form} compact />
        </div>
        <footer className="flex justify-end gap-2 border-t border-border bg-background/60 px-4 py-2.5">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border bg-surface px-4 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
          <button type="submit" disabled={!form.canSubmit || saving} className="btn-brand h-9 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Creating…" : "Create Ticket"}</button>
        </footer>
      </form>
    </>
  );
}
