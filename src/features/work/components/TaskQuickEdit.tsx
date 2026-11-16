"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import AssigneeField, { cleanAssignees } from "@/features/backlog/components/AssigneeField";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { statusOptionsFor } from "@/features/backlog/statusOptions";
import { formatDeadline } from "@/features/backlog/utils";
import type { BacklogItemData, Status } from "@/types/backlog";
import { taskRights } from "../taskRights";

/**
 * The fields a person may change, right in the open details of a task (the same ones, rules and save as the task panel): Status (with the reason Blocked and On hold need, or an optional
 * comment), the Assignees (the Lead only) and the Developer ETA. `item` is the task completed by its own detail, so the fields start from the real values.
 */
export default function TaskQuickEdit({ item, wide = false }: { item: BacklogItemData; wide?: boolean }) {
  const { sprints, leadUpdateItem } = useBacklog();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const sprintClosed = sprints.some((s) => s.name === item.sprint && s.status === "Closed");
  const { isLead, canEdit, etaLocked } = taskRights({ item, user, isAdmin, sprintClosed });
  const [assigned, setAssigned] = useState(item.assignees ?? "");
  const [leadDeadline, setLeadDeadline] = useState(item.leadDeadline ?? "");
  const [status, setStatus] = useState<Status>(item.status);
  const [reason, setReason] = useState(item.blockedReason ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!canEdit) return null;

  const needsReason = status === "Blocked" || status === "On hold";
  const commenting = needsReason || status !== item.status;
  const changed = cleanAssignees(assigned) !== cleanAssignees(item.assignees ?? "") || leadDeadline !== (item.leadDeadline ?? "") || status !== item.status;

  async function save() {
    if (needsReason && !reason.trim()) return setError("Say why it is blocked or on hold.");
    if (item.deadline && leadDeadline && leadDeadline < item.deadline) return setError(`Developer ETA can't be before the Expected ETA (${formatDeadline(item.deadline)}).`);
    setSaving(true);
    const saved = await leadUpdateItem(item.id, { ...(isLead ? { assignees: cleanAssignees(assigned) } : {}), leadDeadline, status, comment: reason });
    setSaving(false);
    if (saved) toast.show(`${item.title} updated`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-3">
      <p className="text-xs text-muted">{isLead ? "You lead this task. Update status, assignees and Developer ETA." : "You're assigned. Update status and Developer ETA."}</p>
      <div className={`grid gap-3 ${wide ? "sm:grid-cols-2" : ""}`}>
        <SelectField floating label="Status" value={status} onChange={(v) => (setStatus(v as Status), setError(""))} options={statusOptionsFor(item)} />
        {isLead && <AssigneeField value={assigned} onChange={(v) => (setAssigned(v), setError(""))} />}
        <TextField label="Developer ETA" type="date" value={leadDeadline} onChange={(v) => (setLeadDeadline(v), setError(""))} min={item.deadline || undefined} disabled={etaLocked} disabledReason="Already set. Only a Super Admin or an Admin can change it." />
      </div>
      {commenting && (
        <TextAreaField
          label={needsReason ? "Why is it blocked or on hold?" : "Comment (optional)"}
          required={needsReason}
          invalid={needsReason && !reason.trim()}
          value={reason}
          onChange={(v) => (setReason(v), setError(""))}
          rows={2}
          placeholder={needsReason ? "What's it waiting on, and who can unblock it?" : "Add a note about this status change"}
        />
      )}
      {error && <FieldError>{error}</FieldError>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={!changed || saving}
        className="w-fit self-end rounded-lg btn-brand px-4 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
