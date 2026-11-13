"use client";

import { statusOptionsFor } from "@/features/backlog/statusOptions";
import { useEffect, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import AssigneeField, { cleanAssignees } from "@/features/backlog/components/AssigneeField";
import PersonLabel from "@/components/ui/PersonLabel";
import { PriorityBadge, StatusBadge, TypeLabel } from "@/components/ui/Badge";
import TaskLoggedHours from "./TaskLoggedHours";
import ActivityTimeline from "@/features/backlog/components/ActivityTimeline";
import BacklogDrawer from "@/features/backlog/components/BacklogDrawer";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline } from "@/features/backlog/utils";
import { getErrorMessage } from "@/lib/apiClient";
import { sprintLabel } from "@/constants/backlog-options";
import { carryOverSource } from "@/features/backlog/carryOver";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import type { BacklogItemData, Status } from "@/types/backlog";
import { FieldError } from "@/components/ui/FieldError";

type Row = { label: string; value: React.ReactNode };

/**
 * Details of a task. For everyone it is read-only (nothing to delete), except that the task's Lead can also manage
 * the Assigned Users and set the Developer ETA here.
 */
export default function ViewTaskDrawer({ item, onClose, viewOnly: forceViewOnly = false }: { item: BacklogItemData; onClose: () => void; /** Details only: no editing controls, even for the task's Lead. */ viewOnly?: boolean }) {
  const { allPods, sprints, items, hiddenItems, leadUpdateItem } = useBacklog();
  // A task of a closed sprint is history: details only, no status / assignee / deadline changes.
  const sprintClosed = sprints.some((s) => s.name === item.sprint && s.status === "Closed");
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  // The task's detail (activity, and whether I may change it) comes from the backend when the panel opens.
  const [detail, setDetail] = useState<BacklogItemData | null>(null);
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    let cancelled = false;
    useItemDetailStore.getState().get(item.id).then(
      (d) => !cancelled && setDetail(d),
      // The list's copy is shown, but the person is told the latest details (activity, what they may change) are missing.
      (err) => !cancelled && setDetailError(getErrorMessage(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [item.id]);
  const activity = detail?.activity?.length ? detail.activity : item.activity;
  const byName = !!item.lead && user?.name.toLowerCase() === item.lead.toLowerCase();
  const isLead = !forceViewOnly && !sprintClosed && !(detail?.readOnly ?? item.readOnly) && (detail?.canLeadEdit ?? item.canLeadEdit ?? byName);
  // An assigned user (not the Lead) may change the task's status and its Developer ETA, nothing else.
  const isAssignee = !isLead && !forceViewOnly && !sprintClosed && !(detail?.readOnly ?? item.readOnly) && !!user && [detail ?? item, item].some((t) => (t.assigneeIds ?? []).map(String).includes(String(user.id)) || (t.assignees ?? "").split(",").some((n) => n.trim().toLowerCase() === user.name.toLowerCase()));
  const canEdit = isLead || isAssignee;
  // The Developer ETA is entered once by the Lead / an assigned user; after that only a Super Admin or an enabled Admin may change it.
  const etaLocked = !isAdmin && !!item.leadDeadline;
  const [assigned, setAssigned] = useState(item.assignees ?? "");
  const [leadDeadline, setLeadDeadline] = useState(item.leadDeadline ?? "");
  const [status, setStatus] = useState<Status>(item.status);
  const [reason, setReason] = useState(item.blockedReason ?? "");
  const [error, setError] = useState("");
  const needsReason = status === "Blocked" || status === "On hold";
  // Any status change can carry a comment; Blocked and On hold require one (why).
  const commenting = needsReason || status !== item.status;

  const taskChanged =
    cleanAssignees(assigned) !== cleanAssignees(item.assignees ?? "") ||
    leadDeadline !== (item.leadDeadline ?? "") ||
    status !== item.status;

  async function save() {
    if (needsReason && !reason.trim()) return setError("Say why it is blocked or on hold."), false;
    if (item.deadline && leadDeadline && leadDeadline < item.deadline) return setError(`Developer ETA can't be before the Expected ETA (${formatDeadline(item.deadline)}).`), false;
    const saved = await leadUpdateItem(item.id, { ...(isLead ? { assignees: cleanAssignees(assigned) } : {}), leadDeadline, status, comment: reason });
    if (!saved) return false;
    toast.show(`${item.title} updated`);
  }

  const pod = item.podId ? allPods.find((p) => p.id === item.podId)?.name : undefined;
  const assignees = (item.assignees ?? "").split(",").map((n) => n.trim()).filter(Boolean);

  const rows: Row[] = [
    { label: "Owner", value: item.owner ? <PersonLabel kind="owner" name={item.owner} size={20} /> : undefined },
    { label: "Lead", value: item.lead ? <PersonLabel kind="user" name={item.lead} size={20} /> : undefined },
    { label: "Type", value: item.type ? <TypeLabel type={item.type} /> : undefined },
    { label: "Priority", value: <PriorityBadge priority={item.priority} /> },
    { label: "Status", value: canEdit ? undefined : <StatusBadge status={item.status} /> },
    { label: "Sprint", value: item.sprint },
    { label: "Carried over from", value: carryOverSource(item, sprints) ?? (item.carriedFrom ? sprintLabel([...items, ...hiddenItems].find((t) => t.id === item.carriedFrom)?.sprint ?? "an earlier sprint") : undefined) },
    { label: "POD", value: pod },
    { label: "Assignees", value: isLead || assignees.length === 0 ? undefined : <span className="flex flex-wrap gap-x-3 gap-y-1">{assignees.map((n) => <PersonLabel key={n} kind="user" name={n} size={20} />)}</span> },
    { label: "Expected ETA", value: item.deadline ? formatDeadline(item.deadline) : undefined },
    { label: "Developer ETA", value: canEdit ? undefined : item.leadDeadline ? formatDeadline(item.leadDeadline) : undefined },
    { label: "Done on", value: item.completed ? formatDeadline(item.completed) : undefined },
  ];

  return (
    <BacklogDrawer heading="Task details" subtitle="Everything about this task in one place." submitLabel="Save changes" onSubmit={canEdit ? save : () => {}} canSubmit={taskChanged} onClose={onClose} viewOnly={!canEdit}>
      {detailError && (
        <FieldError>
          Couldn&apos;t load the latest details ({detailError}). What you see may be out of date.
        </FieldError>
      )}
      <div>
        <p className="text-xs font-medium text-muted">Title</p>
        <p className="mt-1 text-sm font-semibold">{item.title}</p>
      </div>
      {item.description && (
        <div>
          <p className="text-xs font-medium text-muted">Description</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm">{item.description}</p>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {rows
          .filter((r) => r.value)
          .map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-xs font-medium text-muted">{r.label}</dt>
              <dd className="mt-1 break-words">{r.value}</dd>
            </div>
          ))}
      </dl>
      <div>
        <p className="text-xs font-medium text-muted">Task Title</p>
        <p className="mt-1 break-words text-sm font-semibold">{item.title}</p>
      </div>
      {canEdit && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-xs text-muted">{isLead ? "You lead this task. Update status, assignees and Developer ETA." : "You're assigned. Update status and Developer ETA."}</p>
          <SelectField label="Status" value={status} onChange={(v) => (setStatus(v as Status), setError(""))} options={statusOptionsFor(item)} />
          {commenting && (
            <TextAreaField
              label={needsReason ? "Why is it blocked or on hold?" : "Comment (optional)"}
              required={needsReason}
              invalid={needsReason && !reason.trim()}
              value={reason}
              onChange={(v) => (setReason(v), setError(""))}
              placeholder={needsReason ? "What's it waiting on, and who can unblock it?" : "Add a note about this status change"}
            />
          )}
          {isLead && <AssigneeField value={assigned} onChange={setAssigned} />}
          <TextField label="Developer ETA" type="date" value={leadDeadline} onChange={(v) => (setLeadDeadline(v), setError(""))} min={item.deadline || undefined} disabled={etaLocked} disabledReason="Already set. Only a Super Admin or an Admin can change it." />
          {error && (
            <FieldError>
              {error}
            </FieldError>
          )}
        </div>
      )}
      {!canEdit && item.blockedReason && (
        <div>
          <p className="text-xs font-medium text-muted">Why it is {item.status.toLowerCase()}</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm">{item.blockedReason}</p>
        </div>
      )}
      {item.notes && (
        <div>
          <p className="text-xs font-medium text-muted">Notes</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm">{item.notes}</p>
        </div>
      )}
      <TaskLoggedHours taskId={item.id} />
      <ActivityTimeline compact item={detail ?? item} activity={activity} />
    </BacklogDrawer>
  );
}
