"use client";

import { TeamName } from "@/components/ui/NameWithIcon";
import { Fragment, useState } from "react";
import AssigneeStack from "@/components/ui/AssigneeStack";
import { PriorityBadge } from "@/components/ui/Badge";
import { useUsers } from "@/features/users/hooks/useUsers";
import type { BacklogItemData } from "@/types/backlog";
import { CollapseRow } from "@/components/ui/Collapse";
import TaskCardMore, { RowArrow } from "./TaskCardMore";
import CreateTicketButton from "./CreateTicketButton";
import { PRIORITY_ROW } from "../priorityCard";
import { qaColumn, type Sort, type SortKey } from "../qaWorkspace";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Task ID" },
  { key: "title", label: "Task" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "assignee", label: "Assignee" },
  { key: "team", label: "Team" },
  { key: "tickets", label: "Tickets" },
];

/** The QA tasks as a table: id, task, status, priority, assignee, team and Ticket count; click a heading to sort by it, click a row to open the task's full page. */
export default function QaTaskList({ tasks, sort, onSort, onSetSort, selectedId, onOpen, team, reopen, unreadFor }: { /** How many unread notices there are about a task: its row flashes while there are some. */ unreadFor?: (task: BacklogItemData) => number; tasks: readonly BacklogItemData[]; sort: Sort; onSort: (key: SortKey) => void; /** Sets the sort directly (the phone's "Sort by" control, where the header is hidden). */ onSetSort: (sort: Sort) => void; selectedId?: string; onOpen: (task: BacklogItemData) => void; assignee: (task: BacklogItemData) => string; team: (task: BacklogItemData) => string; /** Renders the Reopen button for a Done task the person may reopen. */ reopen: (task: BacklogItemData) => React.ReactNode }) {
  const users = useUsers();
  const people = (t: BacklogItemData) =>
    (t.assignees ?? "").split(",").map((n) => n.trim()).filter(Boolean).map((name) => ({ name, team: users.find((u) => u.name.toLowerCase() === name.toLowerCase())?.team || undefined }));
  // The tasks whose Tickets and comments are open under their row.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  // One row open at a time: opening another closes the open one.
  const toggle = (id: string) => setOpened((o) => (o.has(id) ? new Set() : new Set([id])));
  return (
    <div className="rt-box overflow-hidden card">
      {/* Where the table is a list of cards the header (and its sort buttons) is hidden, so the same sort is offered here (see .rt-only). */}
      <div className="rt-only items-center gap-2 border-b border-border px-3 py-2">
        <label htmlFor="qa-sort" className="text-xs text-muted">Sort by</label>
        <select
          id="qa-sort"
          value={sort?.key ?? ""}
          onChange={(e) => onSetSort(e.target.value ? { key: e.target.value as SortKey, dir: sort?.dir ?? "asc" } : null)}
          className="field h-9 min-w-0 flex-1 px-2 text-sm"
        >
          <option value="">Default order</option>
          {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button
          type="button"
          disabled={!sort}
          onClick={() => sort && onSetSort({ key: sort.key, dir: sort.dir === "asc" ? "desc" : "asc" })}
          aria-label={sort ? `Sorted ${sort.dir === "asc" ? "ascending" : "descending"}, change direction` : "Choose what to sort by first"}
          className="btn btn-secondary btn-sm w-9 px-0"
        >
          {sort?.dir === "desc" ? "↓" : "↑"}
        </button>
      </div>
      <div className="overflow-x-auto">
      <table className="rt w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
                  {c.label}
                  <span aria-hidden="true" className={sort?.key === c.key ? "text-accent" : "opacity-30"}>{sort?.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tasks.map((t) => {
            const col = qaColumn(t.status);
            return (
              <Fragment key={t.id}>
              <tr onClick={() => onOpen(t)} aria-selected={selectedId === t.id} className={`cursor-pointer transition-colors ${unreadFor?.(t) ? "row-flash " : ""}${PRIORITY_ROW[t.priority]}`}>
                <td data-label="Task ID" className="px-3 py-2.5 font-mono text-xs text-muted"><span className="inline-flex items-center gap-2"><RowArrow open={opened.has(t.id)} onToggle={() => toggle(t.id)} />{t.id}</span></td>
                <td data-primary className="max-w-72 px-3 py-2.5">
                  <button type="button" onClick={(e) => (e.stopPropagation(), onOpen(t))} className="break-words text-left font-medium hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">{t.title}</button>
                </td>
                <td data-label="Status" className="px-3 py-2.5"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${col?.tone ?? ""}`}>{col?.title ?? t.status}</span></td>
                <td data-label="Priority" className="px-3 py-2.5"><PriorityBadge priority={t.priority} /></td>
                <td data-label="Assignee" className="px-3 py-2.5 text-xs"><AssigneeStack people={people(t)} size={24} /></td>
                <td data-label="Team" className="px-3 py-2.5 text-xs text-muted">{team(t) ? <TeamName name={team(t)} /> : "–"}</td>
                <td data-label="Tickets" className="px-3 py-2.5 text-xs">{t.ticketStats ? (t.ticketStats.total > 0 ? `${t.ticketStats.done}/${t.ticketStats.total} done` : "0") : "–"}</td>
                <td data-actions className="whitespace-nowrap px-3 py-2.5"><span className="flex items-center justify-end gap-2"><CreateTicketButton task={t} />{reopen(t)}</span></td>
              </tr>
              <CollapseRow open={opened.has(t.id)} colSpan={COLUMNS.length + 1} className={PRIORITY_ROW[t.priority]}><TaskCardMore task={t} /></CollapseRow>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
