"use client";

import { useEffect, useRef, useState } from "react";
import { TextAreaField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Status } from "@/types/backlog";

/** Changes one task's status from the Ready for QA list (Open for testing, or Close as Done). Like every status change it carries a comment. Only this task is touched. */
export default function QaStatusDialog({ task, status, title, confirm, placeholder, onClose, onDone }: { task: BacklogItemData; status: Status; title: string; confirm: string; placeholder: string; onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function save() {
    if (busy || !comment.trim()) return;
    setBusy(true);
    try {
      await backlogService.changeStatusWithDetails(task.id, status, comment.trim());
      toast.show(`${task.id} ${status === "Done" ? "closed as Done" : "is now in " + status}`);
      onDone();
      ref.current?.close();
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-label={title}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-5 text-foreground shadow-modal backdrop:bg-black/60"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted"><span className="font-mono">{task.id}</span> {task.title}</p>
      <div className="mt-3">
        <TextAreaField label="Comment" required rows={3} value={comment} onChange={setComment} placeholder={placeholder} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => ref.current?.close()} className="h-9 rounded-xl border border-border px-4 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
        <button type="button" onClick={() => void save()} disabled={!comment.trim() || busy} className="btn-brand h-9 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
          {busy ? "Saving…" : confirm}
        </button>
      </div>
    </dialog>
  );
}
