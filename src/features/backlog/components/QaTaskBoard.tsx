"use client";

import { useRef, useState } from "react";
import { useStatusFold } from "@/hooks/useStatusFold";
import ColumnEmpty from "@/components/ui/ColumnEmpty";
import type { BacklogItemData } from "@/types/backlog";
import TaskCard from "./TaskCard";
import TaskCardMore from "./TaskCardMore";
import CreateTicketButton from "./CreateTicketButton";
import { QA_COLUMNS } from "../qaWorkspace";

/** Which statuses open first when the board has room for only some: the work in hand, then the others in this order. */
const OPEN_FIRST = ["Testing", "Ready for QA", "Done"];

/**
 * The QA tasks as a board: a column per status (Ready for QA, Testing, Done) with its count and a card per task (id, title, priority, assignee, team, Ticket count). With
 * `onMove` the cards can be dragged to another column (the caller decides whether that move is allowed); a card opens the task's full page.
 */
export default function QaTaskBoard({ tasks, totals, filtering, onOpen, onMove, assignee, team, reopen, unreadFor, onBell }: { tasks: readonly BacklogItemData[]; /** How many tasks each status has before filtering. */ totals: Record<string, number>; filtering: boolean; onOpen: (task: BacklogItemData) => void; onMove?: (task: BacklogItemData, to: string) => void; assignee: (task: BacklogItemData) => string; team: (task: BacklogItemData) => string; reopen: (task: BacklogItemData) => React.ReactNode; unreadFor: (task: BacklogItemData) => number; onBell: (task: BacklogItemData) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  // Only one card is open at a time: opening another closes the open one.
  const [openId, setOpenId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // The statuses fold into slim vertical bars: how many are open follows the width of the board (In Progress first, statuses with cards before empty ones), see useStatusFold.
  const wrap = useRef<HTMLDivElement>(null);
  const fold = useStatusFold(wrap, QA_COLUMNS.map((c) => c.title), OPEN_FIRST, (title) => tasks.some((t) => t.status === QA_COLUMNS.find((c) => c.title === title)?.status));
  /** Dropping a card on a status (its column, or its slim bar when it is folded) moves it there. */
  const drop = (col: (typeof QA_COLUMNS)[number]) =>
    onMove && col.drop
      ? {
          onDragOver: (e: React.DragEvent) => (e.preventDefault(), setOver(col.status)),
          onDragLeave: () => setOver((o) => (o === col.status ? null : o)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const t = tasks.find((x) => x.id === (dragging ?? e.dataTransfer.getData("text/plain")));
            setOver(null);
            setDragging(null);
            if (t) onMove(t, col.status);
          },
        }
      : {};
  // One status column.
  const renderCol = (col: (typeof QA_COLUMNS)[number]) => {
        const cards = tasks.filter((t) => t.status === col.status);
        const total = filtering ? `${cards.length} of ${totals[col.status] ?? 0}` : String(totals[col.status] ?? 0);
          if (fold.isFolded(col.title))
            return (
              <button
                key={col.title}
                type="button"
                onClick={() => fold.toggle(col.title)}
                aria-expanded="false"
                aria-label={`Show ${col.title}, ${total}`}
                aria-disabled={fold.isEmpty(col.title) || undefined} {...drop(col)} title={fold.isEmpty(col.title) ? `${col.title}: nothing here` : `Show ${col.title}`}
                className={`anim-fade-up aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${over === col.status ? "border-accent bg-accent-soft/40 opacity-100!" : ""} flex h-36 w-11 shrink-0 flex-col items-center gap-2 card px-1 py-3 text-sm font-semibold text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent self-stretch`}
              >
                <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium">{total}</span>
                <span className="[writing-mode:vertical-rl]">{col.title}</span>
              </button>
            );
        return (
          <section
            key={col.status}
            aria-label={`${col.title}, ${cards.length}`}
            {...drop(col)}
            data-status-column
            className={`flex min-w-0 flex-col gap-2 self-start rounded-2xl border p-2.5 transition-[flex-grow,border-color,background-color] duration-200 min-h-[14rem] flex-1 has-[[data-disclosure][aria-expanded=true]]:flex-[2.4] ${over === col.status ? "border-accent bg-accent-soft/30" : "border-border bg-surface"}`}
          >
            <h2 className="flex flex-wrap items-center gap-2 px-1 text-sm font-semibold">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${col.tone}`}>{col.title}</span>
              <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium">{total}</span>
              <button type="button" onClick={() => fold.toggle(col.title)} aria-expanded="true" aria-label={`Hide ${col.title}`} title={`Hide ${col.title}`} className="ml-auto rounded-md px-1.5 text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">‹</button>
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
                      className={onMove && t.status !== "Done" ? "cursor-grab" : ""} more={<TaskCardMore task={t} />} open={openId === t.id} onOpenChange={(o) => setOpenId(o ? t.id : null)}
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
  };
  return (
    <div ref={wrap} className="-mx-1 px-1 pb-1">
      {/* The open statuses side by side and, in ONE line at the right, the folded ones as slim vertical bars (count on top, name written vertically). */}
      <div className="flex items-stretch gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3 self-start">{QA_COLUMNS.map((c) => (fold.isFolded(c.title) ? null : renderCol(c)))}</div>
        <div className="flex shrink-0 items-stretch gap-2 empty:hidden">{QA_COLUMNS.map((c) => (fold.isFolded(c.title) ? renderCol(c) : null))}</div>
      </div>
    </div>
  );
}
