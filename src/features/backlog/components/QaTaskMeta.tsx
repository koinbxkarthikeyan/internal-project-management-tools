"use client";

import { PriorityBadge } from "@/components/ui/Badge";
import { useUsers } from "@/features/users/hooks/useUsers";
import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline } from "../utils";

/** The task's needed details as one compact row under its header: priority, Lead, assignees with their teams and the Ready for QA date, */
export default function QaTaskMeta({ task }: { task: BacklogItemData }) {
  const users = useUsers();
  const teamOf = new Map(users.map((u) => [u.id, u.team ?? ""]));
  const names = (task.assignees ?? "").split(", ");
  const assignees = (task.assigneeIds ?? []).map((id, i) => `${names[i] ?? "Someone"}${teamOf.get(id) ? ` · ${teamOf.get(id)}` : ""}`);
  return (
    <div className="-mt-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5"><span className="text-xs text-muted">Priority</span><PriorityBadge priority={task.priority} /></span>
        <span><span className="text-xs text-muted">Lead</span> {task.lead ?? "–"}</span>
        <span><span className="text-xs text-muted">Assignees</span> {assignees.length ? assignees.join(", ") : "Unassigned"}</span>
        <span><span className="text-xs text-muted">Ready for QA</span> {task.readyForQaDate ? formatDeadline(task.readyForQaDate) : "–"}</span>
      </p>
    </div>
  );
}
