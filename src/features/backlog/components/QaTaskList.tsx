"use client";

import { Fragment, useState } from "react";
import { PriorityBadge } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
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
export default function QaTaskList({ tasks, sort, onSort, selectedId, onOpen, assignee, team, reopen, unreadFor }: { /** How many unread notices there are about a task: its row flashes while there are some. */ unreadFor?: (task: BacklogItemData) => number; tasks: readonly BacklogItemData[]; sort: Sort; onSort: (key: SortKey) => void; selectedId?: string; onOpen: (task: BacklogItemData) => void; assignee: (task: BacklogItemData) => string; team: (task: BacklogItemData) => string; /** Renders the Reopen button for a Done task the person may reopen. */ reopen: (task: BacklogItemData) => React.ReactNode }) {
  // The tasks whose Tickets and comments are open under their row.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setOpened((o) => { const n = new Set(o); if (!n.delete(id)) n.add(id); return n; });
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
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
                <td className="px-3 py-2.5 font-mono text-xs text-muted">{t.id}</td>
                <td className="max-w-72 px-3 py-2.5">
                  <button type="button" onClick={(e) => (e.stopPropagation(), onOpen(t))} className="break-words text-left font-medium hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">{t.title}</button>
                </td>
                <td className="px-3 py-2.5"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${col?.tone ?? ""}`}>{col?.title ?? t.status}</span></td>
                <td className="px-3 py-2.5"><PriorityBadge priority={t.priority} /></td>
                <td className="px-3 py-2.5 text-xs">{assignee(t) || "Unassigned"}</td>
                <td className="px-3 py-2.5 text-xs text-muted">{team(t) || "–"}</td>
                <td className="px-3 py-2.5 text-xs">{t.ticketStats ? (t.ticketStats.total > 0 ? `${t.ticketStats.done}/${t.ticketStats.total} done` : "0") : "–"}</td>
                <td className="whitespace-nowrap px-3 py-2.5"><span className="flex items-center justify-end gap-2"><CreateTicketButton task={t} />{reopen(t)}<RowArrow open={opened.has(t.id)} onToggle={() => toggle(t.id)} /></span></td>
              </tr>
              {opened.has(t.id) && (
                <tr className={PRIORITY_ROW[t.priority]}><td colSpan={COLUMNS.length + 1} className="px-3 pb-3"><TaskCardMore task={t} /></td></tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
