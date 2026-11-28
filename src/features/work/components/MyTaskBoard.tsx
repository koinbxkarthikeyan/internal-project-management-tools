"use client";

import { SprintName } from "@/components/ui/NameWithIcon";
import { useRef, useState } from "react";
import { useStatusFold } from "@/hooks/useStatusFold";
import { StatusBadge } from "@/components/ui/Badge";
import ColumnEmpty from "@/components/ui/ColumnEmpty";
import type { BacklogItemData, Status } from "@/types/backlog";
import TaskCard from "@/features/backlog/components/TaskCard";
import TaskCardMore from "@/features/backlog/components/TaskCardMore";
import CreateTicketButton from "@/features/backlog/components/CreateTicketButton";
import { formatDeadline } from "@/features/backlog/utils";

/** The columns, in flow order, and the statuses each holds (Blocked and On hold stay in To Do with their own badge, as on the Tickets board). */
/** `drop` is the status a card dropped on the column gets. */
const COLUMNS: { title: string; statuses: readonly Status[]; drop: Status }[] = [
  { title: "To Do", statuses: ["Open", "Blocked", "On hold"], drop: "Open" },
  { title: "In Progress", statuses: ["In progress"], drop: "In progress" },
  { title: "Ready for QA", statuses: ["Ready for QA"], drop: "Ready for QA" },
  { title: "Testing", statuses: ["Testing"], drop: "Testing" },
  { title: "Done", statuses: ["Done"], drop: "Done" },
];

/** Which statuses open first when the board has room for only some: the work in hand, then the others in this order. */
const OPEN_FIRST = ["In Progress", "To Do", "Ready for QA", "Testing", "Done"];

/**
 * My Task as a board: a column per status with its count and a card per task, in the same card every board uses (id, title, priority, the Ticket count and the unread
 * notifications at the top right; type and sprint, the ETAs and the Ready for QA date as details). A task assigned to the signed-in person has an accent edge, one with
 * an open Ticket for them an amber edge. A card opens the task's own page, like a row does.
 */
export default function MyTaskBoard({ tasks, isMine, openTicketsFor, unreadFor, onBell, onOpen, canDrag, onMove, canDrop }: { /** A card of a task this person may change the status of can be dragged; `onMove` is told the task and the status of the column it was dropped on (it checks the move and asks for the comment). */ canDrag?: (task: BacklogItemData) => boolean; onMove?: (task: BacklogItemData, to: Status) => void; /** Whether the dragged task may be dropped on a column with this status; a column that says no does not light up and refuses the drop. */ canDrop?: (task: BacklogItemData, to: Status) => boolean; tasks: readonly BacklogItemData[]; isMine: (task: BacklogItemData) => boolean; /** How many open Tickets assigned to me a task has (it gets the amber edge). */ openTicketsFor: (task: BacklogItemData) => number; /** How many unread notices there are about a task (or my Tickets under it). */ unreadFor: (task: BacklogItemData) => number; /** Opens the latest unread notice about a task (marking it read). */ onBell: (task: BacklogItemData) => void; onOpen: (task: BacklogItemData) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  // Only one card is open at a time: opening another closes the open one.
  const [openId, setOpenId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // The statuses fold into slim vertical bars: how many are open follows the width of the board (In Progress first, statuses with cards before empty ones), see useStatusFold.
  const wrap = useRef<HTMLDivElement>(null);
  const fold = useStatusFold(wrap, COLUMNS.map((c) => c.title), OPEN_FIRST, (title) => tasks.some((t) => COLUMNS.find((c) => c.title === title)?.statuses.includes(t.status)));
  /** Dropping a card on a status (its column, or its slim bar when it is empty or folded) moves it there. */
  const drop = (col: (typeof COLUMNS)[number]) =>
    onMove
      ? {
          onDragOver: (e: React.DragEvent) => {
            const t = tasks.find((x) => x.id === dragging);
            if (t && canDrop && !canDrop(t, col.drop)) return;
            e.preventDefault();
            setOver(col.title);
          },
          onDragLeave: () => setOver((o) => (o === col.title ? null : o)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const t = tasks.find((x) => x.id === (dragging ?? e.dataTransfer.getData("text/plain")));
            setOver(null);
            setDragging(null);
            if (t && !col.statuses.includes(t.status) && (!canDrop || canDrop(t, col.drop))) onMove(t, col.drop);
          },
        }
      : {};
  // One status column.
  const renderCol = (col: (typeof COLUMNS)[number]) => {
        const cards = tasks.filter((t) => col.statuses.includes(t.status));
          if (fold.isFolded(col.title))
            return (
              <button
                key={col.title}
                type="button"
                onClick={() => fold.toggle(col.title)}
                aria-expanded="false"
                aria-label={`Show ${col.title}, ${cards.length}`}
                aria-disabled={fold.isEmpty(col.title) || undefined} {...drop(col)} title={fold.isEmpty(col.title) ? `${col.title}: nothing here` : `Show ${col.title}`}
                className={`anim-fade-up aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${over === col.title ? "border-accent bg-accent-soft/40 opacity-100!" : ""} flex h-36 w-11 shrink-0 flex-col items-center gap-2 card px-1 py-3 text-sm font-semibold text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent self-stretch`}
              >
                <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium">{cards.length}</span>
                <span className="[writing-mode:vertical-rl]">{col.title}</span>
              </button>
            );
        return (
          <section
            key={col.title}
            aria-label={`${col.title}, ${cards.length}`}
            {...drop(col)}
            data-status-column
            className={`flex min-w-0 flex-col gap-2 self-start rounded-2xl border p-2.5 transition-[flex-grow,border-color,background-color] duration-200 min-h-[15.5rem] flex-1 has-[[data-disclosure][aria-expanded=true]]:flex-[2.4] ${over === col.title ? "border-accent bg-accent-soft/30" : "border-border bg-surface"}`}
          >
            <h2 className="flex items-baseline gap-2 px-1 text-sm font-semibold">
              {col.title} <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium" title="Tasks">{cards.length}</span>
              <button type="button" onClick={() => fold.toggle(col.title)} aria-expanded="true" aria-label={`Hide ${col.title}`} title={`Hide ${col.title}`} className="ml-auto rounded-md px-1.5 text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">‹</button>
            </h2>
            {cards.length === 0 ? (
              <ColumnEmpty>No tasks</ColumnEmpty>
            ) : (
              <ul className="flex flex-col gap-2">
                {cards.map((t) => (
                  <li
                    key={t.id}
                    draggable={!!onMove && !!canDrag?.(t)}
                    onDragStart={onMove && canDrag?.(t) ? (e) => (e.dataTransfer.setData("text/plain", t.id), (e.dataTransfer.effectAllowed = "move"), setDragging(t.id)) : undefined}
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
                      tall
                      more={<TaskCardMore task={t} />} open={openId === t.id} onOpenChange={(o) => setOpenId(o ? t.id : null)}
                      className={onMove && canDrag?.(t) ? "cursor-grab" : ""}
                      onOpen={() => onOpen(t)}
                      ariaLabel={`View ${t.title}${isMine(t) ? " (assigned to you)" : ""}`}
                      hint={openTicketsFor(t) ? `${openTicketsFor(t)} Ticket${openTicketsFor(t) === 1 ? "" : "s"} assigned to you` : isMine(t) ? "Assigned to you" : undefined}
                      footer={<span className="ml-auto"><CreateTicketButton task={t} /></span>}
                      badges={(t.status === "Blocked" || t.status === "On hold") && <StatusBadge status={t.status} />}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">{t.type ?? "–"} · <SprintName name={t.sprint} /></span>
                      <span>Expected ETA: {t.deadline ? formatDeadline(t.deadline) : "–"}</span>
                      <span className="flex flex-wrap gap-x-3">
                        <span className="whitespace-nowrap">Developer ETA: {t.status !== "Ready for QA" && t.status !== "Testing" && t.leadDeadline ? formatDeadline(t.leadDeadline) : "–"}</span>
                        <span className="whitespace-nowrap">Ready for QA {t.readyForQaDate ? formatDeadline(t.readyForQaDate) : "–"}</span>
                      </span>
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
        <div className="flex min-w-0 flex-1 items-start gap-3 self-start">{COLUMNS.map((c) => (fold.isFolded(c.title) ? null : renderCol(c)))}</div>
        <div className="flex shrink-0 items-stretch gap-2 empty:hidden">{COLUMNS.map((c) => (fold.isFolded(c.title) ? renderCol(c) : null))}</div>
      </div>
    </div>
  );
}
