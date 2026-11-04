"use client";

import { statusOptionsFor } from "@/features/backlog/statusOptions";
import { useEffect, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import AssigneeField, { cleanAssignees } from "@/features/backlog/components/AssigneeField";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import CommentsCard from "@/features/comments/CommentsCard";
import TaskFamily from "./TaskFamily";
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
import { DEVELOPER_ETA, EXPECTED_ETA } from "@/constants/eta";

type Row = { label: string; value: React.ReactNode };

/**
 * Details of a task. For everyone it is read-only (nothing to delete), except that the task's Lead can also manage
 * the Assigned Users and set the Developer ETA here.
 */
export default function ViewTaskDrawer({ item, onClose, viewOnly: forceViewOnly = false, assignedToMe = false, inline = false, hideComments = false, onSaved, }: { item: BacklogItemData; onClose: () => void; /** Details only: no editing controls, even for the task's Lead. */ viewOnly?: boolean; /** The task came from My Tasks (the backend lists it as assigned to me), even when its own data names no assignees. */ assignedToMe?: boolean; /** A full-page view (a card in the page, with a Back button) instead of a side panel. */ inline?: boolean; /** Leave the comments out (the page puts them in a column of their own). */ hideComments?: boolean; /** Called after a change was saved (a full-page view reads the task again). */ onSaved?: () => void; }) {
  const { allPods, sprints, items, hiddenItems, leadUpdateItem, changeStatusWithDetails } = useBacklog();
  // A task of a closed sprint is history: details only, no status / assignee / deadline changes.
  const sprintClosed = sprints.some((s) => s.name === item.sprint && s.status === "Closed");
  const { user, isAdmin, isQa } = useAuth();
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
  // With QA (Ready for QA, Testing) the Lead's and the Assigned Users' controls are not shown: only QA and the admins change the task until it is back in development.
  const devLocked = (item.status === "Ready for QA" || item.status === "Testing") && !(isAdmin || isQa);
  const isLead = !devLocked && !forceViewOnly && !sprintClosed && !(detail?.readOnly ?? item.readOnly) && (detail?.canLeadEdit ?? item.canLeadEdit ?? byName);
  // An Assigned User who is not the Lead may change the status (with what they did); the Lead's panel below already covers it.
  const ids = detail?.assigneeIds ?? item.assigneeIds ?? [];
  const mine = assignedToMe || (!!user && (ids.includes(user.id) || (detail?.assignees ?? item.assignees ?? "").toLowerCase().split(",").map((n) => n.trim()).includes(user.name.toLowerCase())));
  // QA (and the admins) work on what is Ready for QA whoever it is assigned to, and mark it Done when the testing is complete.
  const inQa = item.status === "Ready for QA" || item.status === "Testing";
  const qaActs = (isQa || isAdmin) && (inQa || item.type === "Ticket");
  const canChangeStatus = !isLead && !forceViewOnly && !sprintClosed && !(detail?.readOnly ?? item.readOnly) && ((mine && !devLocked) || qaActs);
  const canComplete = isAdmin || (isQa && (inQa || item.type === "Ticket"));
  const [assigned, setAssigned] = useState(item.assignees ?? "");
  const [leadDeadline, setLeadDeadline] = useState(item.leadDeadline ?? "");
  const [status, setStatus] = useState<Status>(item.status);
  // Once a task is with QA (Ready for QA, Testing) the Developer ETA is out of the way; it comes back when the status goes back to a development one.
  const etaHidden = status === "Ready for QA" || status === "Testing";
  const [reason, setReason] = useState(item.blockedReason ?? "");
  const [error, setError] = useState("");
  const needsReason = status === "Blocked" || status === "On hold";
  // Changing the task's status never changes its Tickets: say so when some are still open.
  const openTickets = item.type === "Ticket" || !item.ticketStats ? 0 : item.ticketStats.total - item.ticketStats.done;
  const ticketsNote = openTickets > 0 && status !== item.status && (
    <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      {openTickets} of {item.ticketStats?.total} {openTickets === 1 ? "Ticket is" : "Tickets are"} not Done yet. Changing the task&apos;s status does not close {openTickets === 1 ? "it" : "them"}.
    </p>
  );
  // Any status change can carry a comment; Blocked and On hold require one (why).
  const commenting = needsReason || status !== item.status;

  const taskChanged =
    cleanAssignees(assigned) !== cleanAssignees(item.assignees ?? "") ||
    leadDeadline !== (item.leadDeadline ?? "") ||
    status !== item.status;

  async function saveStatus() {
    const statusChanged = status !== item.status;
    if (statusChanged && !reason.trim()) return setError(needsReason ? "Say why it is blocked or on hold." : "Add a comment about this status change."), false;
    // BACKEND-DEPENDENT: the Developer ETA is saved through the Lead's call (PATCH /items/:id/lead); the server decides whether an Assigned User may use it.
    if (leadDeadline !== (item.leadDeadline ?? "") && !(await leadUpdateItem(item.id, { leadDeadline }))) return false;
    if (statusChanged && !(await changeStatusWithDetails(item.id, status, reason))) return false;
    toast.show(`${item.title} updated`);
    onSaved?.();
  }

  async function save() {
    if (needsReason && !reason.trim()) return setError("Say why it is blocked or on hold."), false;
    const saved = await leadUpdateItem(item.id, { assignees: cleanAssignees(assigned), leadDeadline, status, comment: reason });
    if (!saved) return false;
    toast.show(`${item.title} updated`);
    onSaved?.();
  }

  const pod = item.podId ? allPods.find((p) => p.id === item.podId)?.name : undefined;
  const assignees = (item.assignees ?? "").split(",").map((n) => n.trim()).filter(Boolean);

  const rows: Row[] = [
    { label: "Owner", value: item.owner },
    { label: "Lead", value: item.lead },
    { label: "Type", value: item.type },
    { label: "Priority", value: <PriorityBadge priority={item.priority} /> },
    { label: "Status", value: isLead || canChangeStatus ? undefined : <StatusBadge status={item.status} /> },
    { label: "Sprint", value: item.sprint },
    { label: "Carried over from", value: carryOverSource(item, sprints) ?? (item.carriedFrom ? sprintLabel([...items, ...hiddenItems].find((t) => t.id === item.carriedFrom)?.sprint ?? "an earlier sprint") : undefined) },
    { label: "POD", value: pod },
    { label: "Assignees", value: isLead ? undefined : assignees.join(", ") },
    { label: EXPECTED_ETA, value: item.deadline ? formatDeadline(item.deadline) : undefined },
    { label: DEVELOPER_ETA, value: isLead || (canChangeStatus && mine) || item.status === "Ready for QA" || item.status === "Testing" ? undefined : item.leadDeadline ? formatDeadline(item.leadDeadline) : undefined },
    { label: "Ready for QA Date", value: item.readyForQaDate ? formatDeadline(item.readyForQaDate) : undefined },
    { label: item.status === "Done" ? "Completed" : "Last completed", value: item.completed ? formatDeadline(item.completed) : undefined },
    { label: "Reopened", value: item.status !== "Done" && item.reopenedAt ? formatDeadline(item.reopenedAt) : undefined },
  ];

  // The full-page task: only the key details at the top, then all its Tickets as a board, then the status, hours, history and comments.
  const full = inline && item.type !== "Ticket";

  return (
    <BacklogDrawer inline={inline} heading={item.type === "Ticket" ? "Ticket details" : "Task details"} submitLabel="Save changes" onSubmit={isLead ? save : canChangeStatus ? saveStatus : () => {}} canSubmit={canChangeStatus ? status !== item.status || leadDeadline !== (item.leadDeadline ?? "") : taskChanged} onClose={onClose} viewOnly={!isLead && !canChangeStatus}>
      {detailError && (
        <FieldError>
          Couldn&apos;t load the latest details ({detailError}). What you see may be out of date.
        </FieldError>
      )}
      {!full && (
        <div>
          <p className="text-xs font-medium text-muted">Title</p>
          <p className="mt-1 text-sm font-semibold">{item.title}</p>
        </div>
      )}
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
      {!full && (
        <div>
          <p className="text-xs font-medium text-muted">Task Title</p>
          <p className="mt-1 break-words text-sm font-semibold">{item.title}</p>
        </div>
      )}
      {isLead && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-xs text-muted">{etaHidden ? "You lead this task: change its status and assign users." : "You lead this task: change its status, assign users and set the Developer ETA (Estimated Time of Arrival)."}</p>
          <SelectField label="Status" value={status} onChange={(v) => (setStatus(v as Status), setError(""))} options={statusOptionsFor(item, isAdmin, canComplete)} />
          {ticketsNote}
          {commenting && (
            <TextAreaField
              label={needsReason ? "Why is it blocked or on hold?" : "Comment"}
              required={needsReason}
              invalid={needsReason && !reason.trim()}
              value={reason}
              onChange={(v) => (setReason(v), setError(""))}
              placeholder={needsReason ? "What's it waiting on, and who can unblock it?" : "What did you do? Add a note about this status change"}
            />
          )}
          <AssigneeField value={assigned} onChange={setAssigned} />
          {!etaHidden && <TextField label={DEVELOPER_ETA} type="date" value={leadDeadline} onChange={setLeadDeadline} />}
          {error && (
            <FieldError>
              {error}
            </FieldError>
          )}
        </div>
      )}
      {canChangeStatus && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-xs text-muted">{mine ? (etaHidden ? "You are assigned to this task: change its status." : "You are assigned to this task: change its status and set the Developer ETA (Estimated Time of Arrival).") : item.type === "Ticket" ? "Change this Ticket's status, and mark it Done when it has been checked." : "This task is Ready for QA: change its status, and mark it Done when the testing is complete."}</p>
          <SelectField label="Status" value={status} onChange={(v) => (setStatus(v as Status), setError(""))} options={statusOptionsFor(item, isAdmin, canComplete)} />
          {ticketsNote}
          {commenting && (
            <TextAreaField
              label={needsReason ? "Why is it blocked or on hold?" : "Comment"}
              required
              invalid={!reason.trim()}
              value={reason}
              onChange={(v) => (setReason(v), setError(""))}
              placeholder={needsReason ? "What's it waiting on, and who can unblock it?" : "What did you do? Add a note about this status change"}
            />
          )}
          {mine && !etaHidden && item.type !== "Ticket" && <TextField label={DEVELOPER_ETA} type="date" value={leadDeadline} onChange={setLeadDeadline} />}
          {error && <FieldError>{error}</FieldError>}
        </div>
      )}
      {!isLead && item.blockedReason && (
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
      <TaskFamily item={item} skipTickets />
      <TaskLoggedHours taskId={item.id} />
      <ActivityTimeline compact item={detail ?? item} activity={activity} />
      {!hideComments && <CommentsCard taskId={item.id} reloadToken={Date.parse(item.updatedAt ?? "") || 0} />}
    </BacklogDrawer>
  );
}
