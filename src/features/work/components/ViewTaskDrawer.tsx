"use client";

import { useEffect, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { STATUSES } from "@/constants/backlog-options";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import AssigneeField, { cleanAssignees } from "@/features/backlog/components/AssigneeField";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import BacklogDrawer from "@/features/backlog/components/BacklogDrawer";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline } from "@/features/backlog/utils";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Status } from "@/types/backlog";

type Row = { label: string; value: React.ReactNode };

/**
 * Details of a task. For everyone it is read-only (nothing to delete), except that the task's Lead can also manage
 * the Assigned Users and set the Lead Deadline here.
 */
export default function ViewTaskDrawer({ item, onClose }: { item: BacklogItemData; onClose: () => void }) {
  const { allPods, leadUpdateItem } = useBacklog();
  const { user } = useAuth();
  const toast = useToast();
  // The task's detail (activity, and whether I may change it) comes from the backend when the panel opens.
  const [detail, setDetail] = useState<BacklogItemData | null>(null);
  useEffect(() => {
    let cancelled = false;
    backlogService.getItem(item.id).then(
      (d) => !cancelled && setDetail(d),
      () => undefined, // the list's copy is shown as it is
    );
    return () => {
      cancelled = true;
    };
  }, [item.id]);
  const activity = detail?.activity?.length ? detail.activity : item.activity;
  const byName = !!item.lead && user?.name.toLowerCase() === item.lead.toLowerCase();
  const isLead = !(detail?.readOnly ?? item.readOnly) && (detail?.canLeadEdit ?? item.canLeadEdit ?? byName);
  const [assigned, setAssigned] = useState(item.assignees ?? "");
  const [leadDeadline, setLeadDeadline] = useState(item.leadDeadline ?? "");
  const [status, setStatus] = useState<Status>(item.status);
  const [reason, setReason] = useState(item.blockedReason ?? "");
  const [error, setError] = useState("");
  const needsReason = status === "Blocked" || status === "On hold";

  async function save() {
    if (needsReason && !reason.trim()) return setError("Say why it is blocked or on hold."), false;
    const saved = await leadUpdateItem(item.id, { assignees: cleanAssignees(assigned, item.lead), leadDeadline, status });
    if (!saved) return false;
    toast.show(`${item.id} updated`);
  }

  const pod = item.podId ? allPods.find((p) => p.id === item.podId)?.name : undefined;
  const assignees = (item.assignees ?? "").split(",").map((n) => n.trim()).filter(Boolean);

  const rows: Row[] = [
    { label: "Owner", value: item.owner },
    { label: "Lead", value: item.lead },
    { label: "Type", value: item.type },
    { label: "Priority", value: <PriorityBadge priority={item.priority} /> },
    { label: "Status", value: isLead ? undefined : <StatusBadge status={item.status} /> },
    { label: "Sprint", value: item.sprint },
    { label: "Carried over from", value: item.carriedFrom },
    { label: "POD", value: pod },
    { label: "Assignees", value: isLead ? undefined : assignees.join(", ") },
    { label: "Expected deadline", value: item.deadline ? formatDeadline(item.deadline) : undefined },
    { label: "Lead Deadline", value: isLead ? undefined : item.leadDeadline ? formatDeadline(item.leadDeadline) : undefined },
    { label: "Completed", value: item.completed ? formatDeadline(item.completed) : undefined },
  ];

  return (
    <BacklogDrawer heading={`${item.id} · Task details`} submitLabel="Save changes" onSubmit={isLead ? save : () => {}} onClose={onClose} viewOnly={!isLead}>
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
      {isLead && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-xs text-muted">You lead this task: you can change its status, assign users and set the Lead Deadline.</p>
          <SelectField label="Status" value={status} onChange={(v) => (setStatus(v as Status), setError(""))} options={STATUSES} />
          {needsReason && (
            <TextAreaField
              label="Why is it blocked or on hold?"
              required
              invalid={!reason.trim()}
              value={reason}
              onChange={(v) => (setReason(v), setError(""))}
              placeholder="What's it waiting on, and who can unblock it?"
            />
          )}
          <AssigneeField value={assigned} onChange={setAssigned} exclude={item.lead} />
          <TextField label="Lead Deadline" type="date" value={leadDeadline} onChange={setLeadDeadline} />
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-300">
              {error}
            </p>
          )}
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
      {activity && activity.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted">Activity</p>
          <ul className="mt-1 divide-y divide-border rounded-xl border border-border text-sm">
            {activity.map((a, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2">
                <span className="min-w-0 break-words">{a.text}</span>
                <span className="shrink-0 text-xs text-muted">{formatDeadline(a.date)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BacklogDrawer>
  );
}
