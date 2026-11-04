"use client";

import { useState } from "react";
import ColumnEmpty from "@/components/ui/ColumnEmpty";
import type { BacklogItemData } from "@/types/backlog";
import TaskCard from "./TaskCard";
import TaskCardMore from "./TaskCardMore";
import CreateTicketButton from "./CreateTicketButton";
import { QA_COLUMNS } from "../qaWorkspace";

/**
 * The QA tasks as a board: a column per status (Ready for QA, Testing, Done) with its count and a card per task (id, title, priority, assignee, team, Ticket count). With
 * `onMove` the cards can be dragged to another column (the caller decides whether that move is allowed); a card opens the task's full page.
 */
export default function QaTaskBoard({ tasks, totals, filtering, onOpen, onMove, assignee, team, reopen, unreadFor, onBell }: { tasks: readonly BacklogItemData[]; /** How many tasks each status has before filtering. */ totals: Record<string, number>; filtering: boolean; onOpen: (task: BacklogItemData) => void; onMove?: (task: BacklogItemData, to: string) => void; assignee: (task: BacklogItemData) => string; team: (task: BacklogItemData) => string; reopen: (task: BacklogItemData) => React.ReactNode; unreadFor: (task: BacklogItemData) => number; onBell: (task: BacklogItemData) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {QA_COLUMNS.map((col) => {
        const cards = tasks.filter((t) => t.status === col.status);
        return (
          <section
            key={col.status}
            aria-label={`${col.title}, ${cards.length}`}
            onDragOver={onMove && col.drop ? (e) => (e.preventDefault(), setOver(col.status)) : undefined}
            onDragLeave={onMove && col.drop ? () => setOver((o) => (o === col.status ? null : o)) : undefined}
            onDrop={
              onMove && col.drop
                ? (e) => {
                    e.preventDefault();
                    const t = tasks.find((x) => x.id === (dragging ?? e.dataTransfer.getData("text/plain")));
                    setOver(null);
                    setDragging(null);
                    if (t) onMove(t, col.status);
                  }
                : undefined
            }
            className={`flex min-w-0 flex-col gap-2 rounded-2xl border p-2.5 transition-colors ${cards.length === 0 ? "self-start" : ""} ${over === col.status ? "border-accent bg-accent-soft/30" : "border-border bg-surface"}`}
          >
            <h2 className="flex flex-wrap items-center gap-2 px-1 text-sm font-semibold">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${col.tone}`}>{col.title}</span>
              <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium">{filtering ? `${cards.length} of ${totals[col.status] ?? 0}` : (totals[col.status] ?? 0)}</span>
            </h2>
            {cards.length === 0 ? (
              <ColumnEmpty>{(totals[col.status] ?? 0) === 0 ? "No tasks" : "No tasks match the filters"}</ColumnEmpty>
            ) : (
              <ul className="flex flex-col gap-2">
                {cards.map((t) => (
                  <li
                    key={t.id}
                    draggable={!!onMove && t.status !== "Done"}
                    onDragStart={onMove ? (e) => (e.dataTransfer.setData("text/plain", t.id), (e.dataTransfer.effectAllowed = "move"), setDragging(t.id)) : undefined}
                    onDragEnd={onMove ? () => (setDragging(null), setOver(null)) : undefined}
                    className={dragging === t.id ? "opacity-50" : ""}
                  >
                    <TaskCard
                      title={t.title}
                      code={t.id}
                      priority={t.priority}
                      tickets={t.ticketStats?.total ?? 0}
                      unread={unreadFor(t)}
                      onBell={() => onBell(t)}
                      onOpen={() => onOpen(t)}
                      ariaLabel={`Open ${t.title}`}
                      className={onMove && t.status !== "Done" ? "cursor-grab" : ""} more={<TaskCardMore task={t} />}
                      footer={
                        <>
                          <span>{t.ticketStats ? `${t.ticketStats.total} ${t.ticketStats.total === 1 ? "Ticket" : "Tickets"}${t.ticketStats.total > 0 ? ` · ${t.ticketStats.done} done` : ""}` : ""}</span>
                          <span className="flex items-center gap-1.5"><CreateTicketButton task={t} />{reopen(t)}</span>
                        </>
                      }
                    >
                      <span>{assignee(t) || "Unassigned"}{team(t) ? ` · ${team(t)}` : ""}</span>
                    </TaskCard>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
