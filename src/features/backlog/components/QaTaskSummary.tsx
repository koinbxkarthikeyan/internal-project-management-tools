"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TaskComments from "@/features/comments/TaskComments";
import type { BacklogItemData } from "@/types/backlog";
import { ActivityList } from "./ActivityTimeline";
import { refreshTicketViews } from "../ticketRefresh";
import { useBacklog } from "../context/BacklogContext";
import TicketPanel from "./TicketPanel";
import QaStatusControl from "./QaStatusControl";

/**
 * What sits under a task on the QA pages (its needed details are in the page header), in the same card as a Ticket's: Comments and Activity tabs. Comments holds the task's
 * status, which stays hidden until every one of its Tickets is Done and is then offered to the QA team and the admins, and the conversation; Activity is the task's history.
 */
export default function QaTaskSummary({ task, tickets, canChangeStatus, canCreate = false, onTicketCreated, onChanged }: { task: BacklogItemData; tickets: readonly BacklogItemData[] | null; canChangeStatus: boolean; /** Offers the + (new Ticket) beside the tabs. */ canCreate?: boolean; /** The Tickets block reads its list again. */ onTicketCreated?: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const { refreshItems } = useBacklog();
  const [creating, setCreating] = useState(false);
  // Bumped when a Ticket is made here, so the conversation shows the note it left.
  const [notes, setNotes] = useState(0);
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const allDone = !!tickets && tickets.length > 0 && tickets.every((t) => t.status === "Done");
  const withQa = task.status === "Ready for QA" || task.status === "Testing";
  const tabClass = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`;
  return (
    <section aria-label="Comments" className="relative flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div role="tablist" aria-label="Comments and activity" className="flex gap-1 border-b border-border pb-1">
        <button type="button" role="tab" aria-selected={tab === "comments"} onClick={() => setTab("comments")} className={tabClass(tab === "comments")}>Comments</button>
        <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} className={tabClass(tab === "history")}>Activity</button>
      </div>
      {tab === "comments" ? (
        <>
          {canChangeStatus && withQa && allDone && <QaStatusControl task={task} onChanged={onChanged} />}
          <TaskComments taskId={task.id} onNewTicket={canCreate ? () => setCreating(true) : undefined} fill reloadToken={(Date.parse(task.updatedAt ?? "") || 0) + notes} />
        </>
      ) : (
        <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain">
          <ActivityList entries={task.activity} />
        </div>
      )}
      {creating && (
        <TicketPanel
          task={task}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            // As in the Tickets block: the task may have moved to Testing and the creator been added to it, so the lists and the page read it again.
            refreshItems();
            if (user) refreshTicketViews(user.id);
            setNotes((n) => n + 1);
            onTicketCreated?.();
            onChanged();
          }}
        />
      )}
    </section>
  );
}
