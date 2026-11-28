"use client";

import { ChevronRightIcon } from "@/components/ui/icons";
import { MESSAGES_LABEL } from "@/constants/work";
import TabSwap from "@/components/ui/TabSwap";
import { useState } from "react";
import { useTicketFormSlot } from "../ticketFormSlot";
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
export default function QaTaskSummary({ task, tickets, canChangeStatus, canCreate = false, onTicketCreated, onChanged, onHide }: { /** Adds a "Hide" button at the end of the tab row (the page lets the conversation be folded away). */ onHide?: () => void; task: BacklogItemData; tickets: readonly BacklogItemData[] | null; canChangeStatus: boolean; /** Offers the + (new Ticket) beside the tabs. */ canCreate?: boolean; /** The Tickets block reads its list again. */ onTicketCreated?: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const { refreshItems } = useBacklog();
  const { creating, begin, end } = useTicketFormSlot();
  // Bumped when a Ticket is made here, so the conversation shows the note it left.
  const [notes, setNotes] = useState(0);
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const allDone = !!tickets && tickets.length > 0 && tickets.every((t) => t.status === "Done");
  const withQa = task.status === "Ready for QA" || task.status === "Testing";
  const tabClass = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`;
  return (
    <section aria-label={MESSAGES_LABEL} className="relative flex h-full min-w-0 flex-col gap-3 card p-4">
      <div role="tablist" aria-label={`${MESSAGES_LABEL} and activity`} className="flex gap-1 border-b border-border pb-1">
        <button type="button" role="tab" aria-selected={tab === "comments"} onClick={() => setTab("comments")} className={tabClass(tab === "comments")}>{MESSAGES_LABEL}</button>
        <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} className={tabClass(tab === "history")}>Activity</button>
        {onHide && <button type="button" onClick={onHide} aria-expanded="true" title={`Hide ${MESSAGES_LABEL.toLowerCase()}`} className="ml-auto grid h-8 place-items-center rounded-lg px-2 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent max-[1399px]:w-8 max-[1399px]:border max-[1399px]:border-border"><ChevronRightIcon width={14} height={14} className="-rotate-90 min-[1400px]:hidden" /><span className="hidden min-[1400px]:inline">Hide ›</span></button>}
      </div>
      <TabSwap id={tab} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {tab === "comments" ? (
        <>
          {canChangeStatus && withQa && allDone && <QaStatusControl task={task} onChanged={onChanged} />}
          <TaskComments taskId={task.id} onNewTicket={canCreate ? begin : undefined} fill reloadToken={(Date.parse(task.updatedAt ?? "") || 0) + notes} />
        </>
      ) : (
        <ActivityList entries={task.activity} />
      )}
      </TabSwap>
      {creating && (
        <TicketPanel
          task={task}
          onClose={end}
          onCreated={() => {
            end();
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
