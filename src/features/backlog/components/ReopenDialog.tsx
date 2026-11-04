"use client";

import { useEffect, useRef, useState } from "react";
import { SelectField, TextAreaField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { statusLabel } from "@/constants/backlog-options";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Status } from "@/types/backlog";

/** What a completed Ticket can be reopened to. The same three for everyone who may reopen. */
export const TICKET_REOPEN_STATUSES: Status[] = ["Open", "In progress", "Testing"];

/** Who sees Reopen: the admins, QA, and the Lead of the task (for a Ticket, of its task). The same rule for tasks and Tickets. */
export const canReopenItem = (item: BacklogItemData, task: BacklogItemData | undefined, user: { id: string } | null, isAdmin: boolean, isQa: boolean) =>
  item.status === "Done" && !!user && (isAdmin || isQa || (task ?? item).leadId === user.id);

/**
 * Reopening a completed task or Ticket, with an optional reason; the history records who, when, and from which status to which either way. A task goes back to the status it had before it was completed (not to To Do),
 * and its Tickets stay as they are. A Ticket goes to the status chosen here, and its task is left alone. Id, title, links, history, comments and images are kept.
 */
export default function ReopenDialog({ item, onClose, onReopened }: { item: BacklogItemData; onClose: () => void; onReopened: (item: BacklogItemData) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const isTicket = item.type === "Ticket";
  const back = item.completedFrom && item.completedFrom !== "Done" ? item.completedFrom : "In progress";
  const [status, setStatus] = useState<Status>("In progress");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function reopen() {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await backlogService.reopenItem(item.id, { details: details.trim(), ...(isTicket ? { status } : {}) });
      toast.show(`${item.title} reopened to ${statusLabel(saved.status)}`);
      onReopened(saved);
      ref.current?.close();
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={`Reopen ${item.title}`}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="fixed m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-modal backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-5">
        <header>
          <h2 className="text-base font-semibold">Reopen {isTicket ? "Ticket" : "task"}</h2>
          <p className="mt-0.5 text-sm text-muted"><span className="font-mono">{item.id}</span> · {item.title}</p>
        </header>
        {isTicket ? (
          <>
            <SelectField label="Reopen to" value={status} onChange={(v) => setStatus(v as Status)} options={TICKET_REOPEN_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} />
            <p className="-mt-2 text-xs text-muted">Its task keeps its own status.</p>
          </>
        ) : (
          <p className="rounded-xl bg-hover px-3 py-2 text-sm">
            It goes back to <strong className="font-semibold">{statusLabel(back)}</strong>, the status it had before it was completed. Its Tickets stay as they are.
          </p>
        )}
        <TextAreaField label="Reason (optional)" rows={3} value={details} onChange={setDetails} placeholder="What needs correcting?" />
        <p className="-mt-2 text-xs text-muted">Who reopened it, when, and the old and new status are recorded in its history either way.</p>
        <footer className="flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} className="h-10 rounded-lg border border-border px-4 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
          <button type="button" onClick={() => void reopen()} disabled={busy} className="btn-brand h-10 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Reopening…" : isTicket ? `Reopen to ${statusLabel(status)}` : "Reopen"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
