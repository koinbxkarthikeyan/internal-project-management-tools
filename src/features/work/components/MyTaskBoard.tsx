"use client";

import { StatusBadge } from "@/components/ui/Badge";
import ColumnEmpty from "@/components/ui/ColumnEmpty";
import { sprintLabel } from "@/constants/backlog-options";
import type { BacklogItemData, Status } from "@/types/backlog";
import TaskCard from "@/features/backlog/components/TaskCard";
import TaskCardMore from "@/features/backlog/components/TaskCardMore";
import CreateTicketButton from "@/features/backlog/components/CreateTicketButton";
import { formatDeadline } from "@/features/backlog/utils";

/** The columns, in flow order, and the statuses each holds (Blocked and On hold stay in To Do with their own badge, as on the Tickets board). */
const COLUMNS: { title: string; statuses: readonly Status[] }[] = [
  { title: "To Do", statuses: ["Open", "Blocked", "On hold"] },
  { title: "In Progress", statuses: ["In progress"] },
  { title: "Ready for QA", statuses: ["Ready for QA"] },
  { title: "Testing", statuses: ["Testing"] },
  { title: "Done", statuses: ["Done"] },
];

/**
 * My Task as a board: a column per status with its count and a card per task, in the same card every board uses (id, title, priority, the Ticket count and the unread
 * notifications at the top right; type and sprint, the ETAs and the Ready for QA date as details). A task assigned to the signed-in person has an accent edge, one with
 * an open Ticket for them an amber edge. A card opens the task's own page, like a row does.
 */
export default function MyTaskBoard({ tasks, isMine, openTicketsFor, unreadFor, onBell, onOpen }: { tasks: readonly BacklogItemData[]; isMine: (task: BacklogItemData) => boolean; /** How many open Tickets assigned to me a task has (it gets the amber edge). */ openTicketsFor: (task: BacklogItemData) => number; /** How many unread notices there are about a task (or my Tickets under it). */ unreadFor: (task: BacklogItemData) => number; /** Opens the latest unread notice about a task (marking it read). */ onBell: (task: BacklogItemData) => void; onOpen: (task: BacklogItemData) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {COLUMNS.map((col) => {
        const cards = tasks.filter((t) => col.statuses.includes(t.status));
        return (
          <section key={col.title} aria-label={`${col.title}, ${cards.length}`} className={`flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-2.5 ${cards.length === 0 ? "self-start" : ""}`}>
            <h2 className="flex items-baseline gap-2 px-1 text-sm font-semibold">
              {col.title} <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium" title="Tasks">{cards.length}</span>
            </h2>
            {cards.length === 0 ? (
              <ColumnEmpty>No tasks</ColumnEmpty>
            ) : (
              <ul className="flex flex-col gap-2">
                {cards.map((t) => (
                  <li key={t.id}>
                    <TaskCard
                      title={t.title}
                      code={t.id}
                      priority={t.priority}
                      tickets={t.ticketStats?.total ?? 0}
                      unread={unreadFor(t)}
                      onBell={() => onBell(t)}
                      tall
                      more={<TaskCardMore task={t} />}
                      onOpen={() => onOpen(t)}
                      ariaLabel={`View ${t.title}${isMine(t) ? " (assigned to you)" : ""}`}
                      hint={openTicketsFor(t) ? `${openTicketsFor(t)} Ticket${openTicketsFor(t) === 1 ? "" : "s"} assigned to you` : isMine(t) ? "Assigned to you" : undefined}
                      footer={<span className="ml-auto"><CreateTicketButton task={t} /></span>}
                      badges={(t.status === "Blocked" || t.status === "On hold") && <StatusBadge status={t.status} />}
                    >
                      <span>{t.type ?? "–"} · {sprintLabel(t.sprint)}</span>
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
      })}
    </div>
  );
}
