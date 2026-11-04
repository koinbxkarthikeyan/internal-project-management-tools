"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { READY_FOR_QA_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUsers } from "@/features/users/hooks/useUsers";
import { unreadForTask, unreadNoticesForTask } from "@/features/notifications/forTask";
import { useOpenNotification } from "@/features/notifications/open";
import { useNotificationStore } from "@/features/notifications/store";
import { useQueryState } from "@/hooks/useQueryState";
import { teamId } from "@/lib/auth/teams";
import { getErrorMessage } from "@/lib/apiClient";
import { onExternalChange } from "@/lib/localApi";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { QA_COLUMNS, sortTasks, type Sort, type SortKey } from "../qaWorkspace";
import QaStatusDialog from "./QaStatusDialog";
import TaskFilterBar, { NO_TASK_FILTERS, type TaskFilters } from "./TaskFilterBar";
import QaTaskBoard from "./QaTaskBoard";
import QaTaskList from "./QaTaskList";
import ReopenDialog, { canReopenItem } from "./ReopenDialog";

type Filters = TaskFilters;
const NO_FILTERS = NO_TASK_FILTERS;
const KEY = "koinbx.qaWorkspace";

/** The search, filters, sort and the task last opened, kept while the tab is open so they are still there after opening a task and coming back. */
function saved(): { filters: Filters; sort: Sort; selected: string | null } {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (raw) return { filters: { ...NO_FILTERS, ...raw.filters }, sort: raw.sort ?? null, selected: raw.selected ?? null };
  } catch {
    /* nothing kept */
  }
  return { filters: NO_FILTERS, sort: null, selected: null };
}

/**
 * QA Workspace: every task handed to QA, in one page, for the QA team, the Super Admin and enabled Admins, in the same three statuses (Ready for QA, Testing, Done) for
 * everyone. List View is a sortable table; Board View is a column per status with draggable cards. Both read the same tasks and share the search and filters, so a change in
 * one shows in the other at once. QA members move a task Ready for QA → Testing → Done by dragging it on the board (each move asks for the usual status comment and changes
 * only that task; Done also needs all its Tickets Done); a Done task can be reopened and goes back to the status it had. A task opens as its own full page.
 */
export default function QaWorkspacePage() {
  const router = useRouter();
  const toast = useToast();
  const { items } = useBacklog();
  const { user, isQa, isAdmin } = useAuth();
  const users = useUsers();
  const notices = useNotificationStore((s) => s.items);
  const openNotification = useOpenNotification();
  const [view, setView] = useQueryState<"list" | "board">("view", ["list", "board"], "list", "qaWorkspaceView");
  const [queue, setQueue] = useState<BacklogItemData[] | null>(null);
  const [error, setError] = useState("");
  const [start] = useState(saved);
  const [filters, setFilters] = useState<Filters>(start.filters);
  const [sort, setSort] = useState<Sort>(start.sort);
  const [selected, setSelected] = useState<string | null>(start.selected);
  const [reopening, setReopening] = useState<BacklogItemData | null>(null);
  // A task being moved: the status it is going to, which asks for its comment.
  const [moving, setMoving] = useState<{ task: BacklogItemData; to: "Testing" | "Done" } | null>(null);

  const remember = (next: Partial<{ filters: Filters; sort: Sort; selected: string | null }>) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ filters, sort, selected, ...next }));
    } catch {
      /* not kept */
    }
  };
  const changeFilters = (f: Filters) => (setFilters(f), remember({ filters: f }));
  const changeSort = (key: SortKey) => {
    // First click ascending, second descending, third back to the default order.
    const next: Sort = sort?.key !== key ? { key, dir: "asc" } : sort.dir === "asc" ? { key, dir: "desc" } : null;
    setSort(next);
    remember({ sort: next });
  };

  const load = useCallback(() => {
    backlogService.getQaQueue().then(
      (next) => (setQueue(next), setError("")),
      (err) => setError(getErrorMessage(err)),
    );
  }, []);
  // Read on opening, whenever the shared tasks change (a status saved from a task page), and when another tab of this browser changes the data.
  useEffect(load, [load, items]);
  useEffect(() => onExternalChange(load), [load]);

  const teamOf = useMemo(() => new Map(users.map((u) => [u.id, u.team ?? ""])), [users]);
  const people = useCallback(
    (t: BacklogItemData) => (t.assigneeIds ?? []).map((id, i) => ({ id, name: (t.assignees ?? "").split(", ")[i] ?? "Someone", team: teamOf.get(id) ?? "" })),
    [teamOf],
  );
  const assigneeText = (t: BacklogItemData) => people(t).map((p) => p.name).join(", ");
  const teamText = (t: BacklogItemData) => [...new Set(people(t).map((p) => p.team).filter(Boolean))].join(", ");

  const all = queue ?? [];
  const totals = Object.fromEntries(QA_COLUMNS.map((c) => [c.status, all.filter((t) => t.status === c.status).length]));
  const teams = [...new Map(all.flatMap((t) => people(t).filter((p) => p.team).map((p) => [teamId(p.team), p.team] as const))).entries()];
  const assignees = [...new Map(all.flatMap((t) => people(t).map((p) => [p.id, p.name] as const))).entries()];

  const q = filters.search.trim().toLowerCase();
  const shown = all.filter(
    (t) =>
      (!q || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)) &&
      (!filters.status || t.status === filters.status) &&
      (!filters.priority || t.priority === filters.priority) &&
      (!filters.team || people(t).some((p) => p.team && teamId(p.team) === filters.team)) &&
      (!filters.assignee || (t.assigneeIds ?? []).includes(filters.assignee)),
  );
  const filtering = Object.values(filters).some(Boolean);
  const canWork = isQa || isAdmin;

  const open = (t: BacklogItemData) => {
    useNotificationStore.getState().markTaskRead(t);
    setSelected(t.id);
    remember({ selected: t.id });
    router.push(`${READY_FOR_QA_HREF}/task?id=${t.apiId}`);
  };

  /** Ready for QA → Testing → Done, one step at a time; Done also waits for every Ticket. A Done task is brought back with Reopen. */
  function move(task: BacklogItemData, to: string) {
    if (task.status === to) return;
    if (task.status === "Done") return toast.show("Use Reopen to bring a Done task back.", "danger");
    if (task.status === "Ready for QA" && to === "Testing") return setMoving({ task, to });
    if (task.status === "Testing" && to === "Done") {
      const t = task.ticketStats;
      if (!t || t.total === 0 || t.done < t.total) return toast.show(`Finish all of ${task.id}'s Tickets first.`, "danger");
      return setMoving({ task, to });
    }
    toast.show("Tasks move Ready for QA → Testing → Done.", "danger");
  }

  const reopen = (t: BacklogItemData) =>
    canReopenItem(t, undefined, user, isAdmin, isQa) ? (
      <button type="button" onClick={(e) => (e.stopPropagation(), setReopening(t))} className="h-7 rounded-lg border border-border px-2.5 text-[11px] font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Reopen</button>
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="QA Workspace"
        description="Every task handed to QA, whoever it is assigned to: Ready for QA, Testing and Done. Drag a card on the board to the next status, or click a task to open its full page."
        actions={
          <div role="group" aria-label="View" className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
            {(["list", "board"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-8 px-3 capitalize focus-visible:outline-2 focus-visible:outline-accent ${view === v ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover"}`}>
                {v}
              </button>
            ))}
          </div>
        }
      />
      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : queue === null ? (
        <div className="h-24 animate-pulse rounded-xl bg-hover" role="status" aria-label="Loading" />
      ) : (
        <>
          <TaskFilterBar label="Filter QA tasks" filters={filters} onChange={changeFilters} statuses={QA_COLUMNS.map((c) => ({ value: c.status, label: c.title }))} teams={teams} assignees={assignees} />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Counts">
            {QA_COLUMNS.map((c) => <span key={c.status}>{c.title} <strong className="text-foreground">{totals[c.status]}</strong></span>)}
            {filtering && <span role="status">Showing {shown.length} of {all.length}</span>}
          </p>

          {all.length === 0 ? (
            <EmptyState title="Nothing is with QA" description="Tasks set to Ready for QA show up here." />
          ) : view === "list" ? (
            shown.length === 0 ? (
              <EmptyState title="No tasks match" description="Try other filters or clear them." />
            ) : (
              <QaTaskList tasks={sortTasks(shown, sort, assigneeText, teamText)} sort={sort} onSort={changeSort} selectedId={selected ?? undefined} onOpen={open} assignee={assigneeText} team={teamText} reopen={reopen} unreadFor={(t) => unreadForTask(notices, t)} />
            )
          ) : (
            <QaTaskBoard tasks={sortTasks(shown, sort, assigneeText, teamText)} totals={totals} filtering={filtering} onOpen={open} onMove={canWork ? move : undefined} assignee={assigneeText} team={teamText} reopen={reopen} unreadFor={(t) => unreadForTask(notices, t)} onBell={(t) => { const n = unreadNoticesForTask(notices, t)[0]; if (n) openNotification(n); }} />
          )}
        </>
      )}
      {moving && (
        <QaStatusDialog
          key={`${moving.task.id}:${moving.to}`}
          task={moving.task}
          status={moving.to}
          title={moving.to === "Testing" ? "Move to Testing" : "Move to Done"}
          confirm={moving.to === "Testing" ? "Move to Testing" : "Move to Done"}
          placeholder={moving.to === "Testing" ? "What will you test?" : "What was tested?"}
          onClose={() => setMoving(null)}
          onDone={load}
        />
      )}
      {reopening && <ReopenDialog item={reopening} onClose={() => setReopening(null)} onReopened={() => load()} />}
    </div>
  );
}
