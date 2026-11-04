"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { useOpenNotification } from "@/features/notifications/open";
import { useNotificationStore } from "@/features/notifications/store";
import ColumnEmpty from "@/components/ui/ColumnEmpty";
import type { BacklogItemData, Status } from "@/types/backlog";
import { formatDeadline } from "../utils";
import ReopenedBadge from "./ReopenedBadge";
import TaskCard from "./TaskCard";

/** The columns of the board, in order, and the statuses each holds (Blocked and On hold stay in To Do with their own badge). */
const COLUMNS: { title: string; statuses: readonly Status[]; /** The status a card dropped here is moved to (none for Ready for QA: a Ticket is never set to it). */ drop?: Status }[] = [
  { title: "To Do", statuses: ["Open", "Blocked", "On hold"], drop: "Open" },
  { title: "In Progress", statuses: ["In progress"], drop: "In progress" },
  { title: "Ready for QA", statuses: ["Ready for QA"] },
  { title: "Testing", statuses: ["Testing"], drop: "Testing" },
  { title: "Done", statuses: ["Done"], drop: "Done" },
];

/** A task's Tickets as a board, Jira style: a column per status (Ready for QA only for a Ticket that still has it) with its count and a card per Ticket (ID, title, priority, assignee, created date). Click a card to open the Ticket. */
export default function TicketBoard({ tickets, onOpen, selectedId, onMove }: { tickets: readonly BacklogItemData[]; onOpen?: (ticket: BacklogItemData) => void; /** The Ticket whose details are showing: its card is marked. */ selectedId?: string; /** Makes the cards draggable; called with the Ticket and the status of the column it was dropped on (the caller decides whether that is allowed). */ onMove?: (ticket: BacklogItemData, to: Status) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // The unread notices about a Ticket (its own code), shown on its card like a task's.
  const notices = useNotificationStore((s) => s.items);
  const openNotification = useOpenNotification();
  const unreadFor = (t: BacklogItemData) => notices.filter((n) => !n.read && n.taskCode === t.id).length;
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="grid min-w-[42rem] gap-3" style={{ gridTemplateColumns: `repeat(${COLUMNS.filter((c) => c.title !== "Ready for QA" || tickets.some((t) => t.status === "Ready for QA")).length}, minmax(0, 1fr))` }}>
        {COLUMNS.filter((col) => col.title !== "Ready for QA" || tickets.some((t) => t.status === "Ready for QA")).map((col) => {
          const cards = tickets.filter((t) => col.statuses.includes(t.status));
          return (
            <section
              key={col.title}
              aria-label={`${col.title}, ${cards.length}`}
              onDragOver={onMove && col.drop ? (e) => (e.preventDefault(), setOver(col.title)) : undefined}
              onDragLeave={onMove && col.drop ? () => setOver((o) => (o === col.title ? null : o)) : undefined}
              onDrop={
                onMove && col.drop
                  ? (e) => {
                      e.preventDefault();
                      const t = tickets.find((x) => x.id === (dragging ?? e.dataTransfer.getData("text/plain")));
                      setOver(null);
                      setDragging(null);
                      if (t && !col.statuses.includes(t.status)) onMove(t, col.drop as Status);
                    }
                  : undefined
              }
              className={`flex min-w-0 flex-col gap-2 rounded-2xl border p-2.5 transition-colors ${cards.length === 0 ? "self-start" : ""} ${over === col.title ? "border-accent bg-accent-soft/30" : "border-border bg-surface"}`}
            >
              <h3 className="flex items-baseline gap-2 px-1 text-sm font-semibold">
                {col.title} <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium">{cards.length}</span>
              </h3>
              {cards.length === 0 ? (
                <ColumnEmpty>No Tickets</ColumnEmpty>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((t) => (
                    <li
                      key={t.id}
                      draggable={!!onMove}
                      onDragStart={onMove ? (e) => (e.dataTransfer.setData("text/plain", t.id), e.dataTransfer.effectAllowed = "move", setDragging(t.id)) : undefined}
                      onDragEnd={onMove ? () => (setDragging(null), setOver(null)) : undefined}
                      className={dragging === t.id ? "opacity-50" : ""}
                    >
                      <TaskCard
                        title={t.title}
                        code={t.id}
                        priority={t.priority}
                        unread={unreadFor(t)}
                        onBell={() => { const n = notices.find((x) => !x.read && x.taskCode === t.id); if (n) openNotification(n); }}
                        onOpen={onOpen ? () => onOpen(t) : undefined}
                        ariaLabel={`Open ${t.title}`}
                        className={`${selectedId === t.id ? "ring-2 ring-accent" : ""} ${onMove ? "cursor-grab" : ""}`}
                        badges={
                          <>
                            <ReopenedBadge item={t} />
                            {(t.status === "Blocked" || t.status === "On hold") && <StatusBadge status={t.status} />}
                          </>
                        }
                        footer={<span className="truncate" title={t.assignees ? `${t.assignees}${t.assignedTeam ? ` · ${t.assignedTeam}` : ""}` : "Unassigned"}>{t.assignees || "Unassigned"}{t.assignees && t.assignedTeam ? ` · ${t.assignedTeam}` : ""}</span>}
                      >
                        <span>{t.created ? formatDeadline(t.created) : "–"}</span>
                        <span title="Created by (team)">By {t.createdBy ?? "–"}{t.createdByTeam ? ` · ${t.createdByTeam}` : ""}</span>
                      </TaskCard>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
