"use client";

import { useState } from "react";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Status } from "@/types/backlog";

/** What QA can set on the task itself: keep testing, finish it, or send it back to development. */
const OPTIONS: Status[] = ["Testing", "Done", "In progress"];

/**
 * Shown at the top of a task in Ready for QA, for the QA team, once every one of its Tickets is Done: the status of the task itself (the main Backlog task),
 * with the comment every status change carries.
 */
export default function QaStatusControl({ task, onChanged }: { task: BacklogItemData; onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = !!status && !!comment.trim() && !busy;

  async function save() {
    if (!ready) return;
    setBusy(true);
    try {
      await backlogService.changeStatusWithDetails(task.id, status as Status, comment.trim());
      toast.show(`${task.title} is now ${status}`);
      setStatus("");
      setComment("");
      onChanged();
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 sm:flex-row sm:items-end">
      <p className="text-sm font-medium text-emerald-700 sm:max-w-48 dark:text-emerald-300">All Tickets are done. Change the task&apos;s status:</p>
      <SelectField className="sm:w-44" label="Status" value={status} onChange={setStatus} options={OPTIONS.map((s) => ({ value: s, label: s }))} placeholder="Choose status" />
      <TextField className="min-w-0 flex-1" label="Comment" value={comment} onChange={setComment} placeholder="What was tested?" />
      <button
        type="button"
        onClick={() => void save()}
        disabled={!ready}
        className="btn-brand h-10 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save status"}
      </button>
    </div>
  );
}
