"use client";

import { useState } from "react";
import { TextAreaField } from "@/components/ui/FormControls";

/** QA's way of returning work: a button that opens a short box asking what needs fixing (required), then "Send back to developer". */
export default function SendBack({ onSend, className = "" }: { onSend: (reason: string) => Promise<void> | void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      await onSend(reason.trim());
      setOpen(false);
      setReason("");
    } catch {
      // It was refused (the page already said why): the box stays open with what was typed.
    } finally {
      setBusy(false);
    }
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`h-8 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent ${className}`}>
        Send back to developer
      </button>
    );
  }
  return (
    <div role="group" aria-label="Send back to developer" className="flex w-full flex-col gap-3 card-inset p-3">
      <TextAreaField label="What needs fixing?" required value={reason} onChange={setReason} placeholder="What failed, and what to check again" />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => (setOpen(false), setReason(""))} disabled={busy} className="h-8 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-hover disabled:opacity-60">Cancel</button>
        <button type="button" onClick={() => void send()} disabled={busy || !reason.trim()} title={!reason.trim() ? "Say what needs fixing first." : undefined} className="btn-brand h-8 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Sending…" : "Send back to developer"}</button>
      </div>
    </div>
  );
}
