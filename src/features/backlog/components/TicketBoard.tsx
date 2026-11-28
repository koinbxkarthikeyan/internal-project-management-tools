"use client";

import { MESSAGES_LABEL } from "@/constants/work";
import { StatusBadge } from "@/components/ui/Badge";
import FitList from "@/components/ui/FitList";
import { useRef, useState } from "react";
import { useStatusFold } from "@/hooks/useStatusFold";
import AssigneeStack, { assigneePeople } from "@/components/ui/AssigneeStack";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useOpenNotification } from "@/features/notifications/open";
import { useNotificationStore } from "@/features/notifications/store";
import ColumnEmpty from "@/components/ui/ColumnEmpty";
import type { BacklogItemData, Status } from "@/types/backlog";
import { formatDeadline } from "../utils";
import ReopenedBadge from "./ReopenedBadge";
import TicketMore from "./TicketMore";
import TaskCard from "./TaskCard";

/** Which statuses open first when the board has room for only some: the work in hand, then the others in this order. */
const OPEN_FIRST = ["In Progress", "To Do", "Ready for QA", "Testing", "Done"];

/** The columns of the board, in order, and the statuses each holds (Blocked and On hold stay in To Do with their own badge). */
const COLUMNS: { title: string; statuses: readonly Status[]; /** The status a card dropped here is moved to. */ drop?: Status }[] = [
  { title: "To Do", statuses: ["Open", "Blocked", "On hold"], drop: "Open" },
  { title: "In Progress", statuses: ["In progress"], drop: "In progress" },
  { title: "Ready for QA", statuses: ["Ready for QA"], drop: "Ready for QA" },
  { title: "Testing", statuses: ["Testing"], drop: "Testing" },
  { title: "Done", statuses: ["Done"], drop: "Done" },
];


/** A task's Tickets as a board, Jira style: a column per status  with its count and a card per Ticket (ID, title, priority, assignee, created date). Click a card to open the Ticket. */
export default function TicketBoard({ tickets, onOpen, selectedId, onMove, collapseSidebar = true }: { tickets: readonly BacklogItemData[]; /** Collapse the sidebar while one of the cards is open (the board is squeezed then); the page turns it off when it has room. */ collapseSidebar?: boolean; onOpen?: (ticket: BacklogItemData) => void; /** The Ticket whose details are showing: its card is marked. */ selectedId?: string; /** Makes the cards draggable; called with the Ticket and the status of the column it was dropped on (the caller decides whether that is allowed). */ onMove?: (ticket: BacklogItemData, to: Status) => void }) {
    const users = useUsers();
const [dragging, setDragging] = useState<string | null>(null);
  // Only one card is open at a time: opening another closes the open one.
  const [openId, setOpenId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // The unread notices about a Ticket (its own code), shown on its card like a task's.
  const notices = useNotificationStore((s) => s.items);
  const openNotification = useOpenNotification();
  const unreadFor = (t: BacklogItemData) => notices.filter((n) => !n.read && n.taskCode === t.id).length;
  // The statuses fold into slim vertical bars: how many are open follows the width of the board (In Progress first, statuses with cards before empty ones), see useStatusFold.
  const wrap = useRef<HTMLDivElement>(null);
  const fold = useStatusFold(wrap, COLUMNS.map((c) => c.title), OPEN_FIRST, (title) => tickets.some((t) => COLUMNS.find((c) => c.title === title)?.statuses.includes(t.status)));
  /** Dropping a card on a status (its column, or its slim bar when it is empty or folded) moves it there. */
  const drop = (col: (typeof COLUMNS)[number]) =>
    onMove && col.drop
      ? {
          onDragOver: (e: React.DragEvent) => (e.preventDefault(), setOver(col.title)),
          onDragLeave: () => setOver((o) => (o === col.title ? null : o)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const t = tickets.find((x) => x.id === (dragging ?? e.dataTransfer.getData("text/plain")));
            setOver(null);
            setDragging(null);
            if (t && !col.statuses.includes(t.status)) onMove(t, col.drop as Status);
          },
        }
      : {};
  // One status column.
  const renderCol = (col: (typeof COLUMNS)[number]) => {
          const cards = tickets.filter((t) => col.statuses.includes(t.status));
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
            className={`flex min-w-0 flex-1 flex-col gap-2 self-start rounded-2xl border p-2.5 transition-[flex-grow,border-color,background-color] duration-200 min-h-[14rem] has-[[data-disclosure][aria-expanded=true]]:flex-[2.4] ${over === col.title ? "border-accent bg-accent-soft/30" : "border-border bg-surface"}`}
            >
              <h3 className="flex items-baseline gap-2 px-1 text-sm font-semibold">
                {col.title} <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium">{cards.length}</span>
                <button type="button" onClick={() => fold.toggle(col.title)} aria-expanded="true" aria-label={`Hide ${col.title}`} title={`Hide ${col.title}`} className="ml-auto rounded-md px-1.5 text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">‹</button>
              </h3>
              {cards.length === 0 ? (
                <ColumnEmpty>No Tickets</ColumnEmpty>
              ) : (
                // Each column scrolls on its own, within the height of the screen, so a column with many Tickets doesn't make the page long.
                <FitList className="flex flex-col gap-2 p-0.5 pr-1.5">
                  {cards.map((t) => (
                    <li
                      key={t.id}
                      draggable={!!onMove}
                      onDragStart={onMove ? (e) => (e.dataTransfer.setData("text/plain", t.id), e.dataTransfer.effectAllowed = "move", setDragging(t.id)) : undefined}
                      onDragEnd={onMove ? () => (setDragging(null), setOver(null)) : undefined}
                      className={dragging === t.id ? "opacity-50" : ""}
                    >
                      <TaskCard
                        collapseSidebar={collapseSidebar}
                        title={t.title}
                        code={t.id}
                        priority={t.priority}
                        unread={unreadFor(t)}
                        onBell={() => { const n = notices.find((x) => !x.read && x.taskCode === t.id); if (n) openNotification(n); }}
                        onOpen={onOpen ? () => onOpen(t) : undefined}
                        ariaLabel={`Open ${t.title}`}
                        more={<TicketMore ticket={t} />} open={openId === t.id} onOpenChange={(o) => setOpenId(o ? t.id : null)}
                        moreLabel={`${MESSAGES_LABEL.toLowerCase()} and details`}
                        className={`${selectedId === t.id ? "ring-2 ring-accent" : ""} ${onMove ? "cursor-grab" : ""}`}
                        badges={
                          <>
                            <ReopenedBadge item={t} />
                            {(t.status === "Blocked" || t.status === "On hold") && <StatusBadge status={t.status} />}
                            
                            {/* The assignee sits at the right end of the id / priority row. */}
                            <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
                              <AssigneeStack people={assigneePeople(t.assignees, users)} size={22} />
                            </span>
                          </>
                        }
                      >
                        <span>{t.created ? formatDeadline(t.created) : "–"}</span>
                        <span title="Created by (team)">By {t.createdBy ?? "–"}{t.createdByTeam ? ` · ${t.createdByTeam}` : ""}</span>
                      </TaskCard>
                    </li>
                  ))}
                </FitList>
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
