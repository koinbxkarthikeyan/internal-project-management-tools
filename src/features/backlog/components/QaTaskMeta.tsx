"use client";

import AssigneeStack from "@/components/ui/AssigneeStack";
import { PriorityBadge } from "@/components/ui/Badge";
import { useUsers } from "@/features/users/hooks/useUsers";
import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline } from "../utils";

/** The task's needed details as one compact row under its header: priority, Lead, assignees with their teams and the Ready for QA date, */
export default function QaTaskMeta({ task, inline = false }: { task: BacklogItemData; /** Inside the details dropdown (no pull-up margin). */ inline?: boolean }) {
  const users = useUsers();
  const teamOf = new Map(users.map((u) => [u.id, u.team ?? ""]));
  const names = (task.assignees ?? "").split(", ");
  const assignees = (task.assigneeIds ?? []).map((id, i) => ({ name: names[i] ?? "Someone", team: teamOf.get(id) || undefined }));
  const date = task.readyForQaDate ? formatDeadline(task.readyForQaDate) : "";
  return (
    <div className={`text-sm ${inline ? "" : "-mt-1 sm:-mt-3"}`}>
      {/* On a small screen only the short form: no "Priority" / "Assignees" words, the Lead and the date without the year; the full labels return from the sm size up. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
        <span className="flex items-center gap-1.5"><span className="hidden text-xs text-muted sm:inline">Priority</span><PriorityBadge priority={task.priority} /></span>
        <span className="min-w-0 truncate"><span className="text-xs text-muted">Lead</span> {task.lead ?? "–"}</span>
        <span className="flex items-center gap-1.5"><span className="hidden text-xs text-muted sm:inline">Assignees</span><AssigneeStack people={assignees} size={24} /></span>
        <span className="whitespace-nowrap"><span className="text-xs text-muted"><span className="sm:hidden">QA</span><span className="hidden sm:inline">Ready for QA</span></span> {date ? <><span className="sm:hidden">{date.replace(/\s\d{4}$/, "")}</span><span className="hidden sm:inline">{date}</span></> : "–"}</span>
      </p>
    </div>
  );
}
