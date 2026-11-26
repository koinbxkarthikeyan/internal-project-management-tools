"use client";

import { MESSAGES_LABEL } from "@/constants/work";
import { useState } from "react";
import TabSwap from "@/components/ui/TabSwap";
import { assigneePeople } from "@/components/ui/AssigneeStack";
import TaskComments from "@/features/comments/TaskComments";
import { useUsers } from "@/features/users/hooks/useUsers";
import type { BacklogItemData } from "@/types/backlog";

const when = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "–";
};

/**
 * What a Ticket's arrow opens, in the List View (under its row) and in the Board View (inside its card), on **Comments** first: **Details** (who created it and their team, the assigned team, the date,
 * the description) and **Comments** (the Ticket's own conversation). Clicks inside it never open or select the Ticket.
 */
export default function TicketMore({ ticket }: { ticket: BacklogItemData }) {
  const users = useUsers();
  const [tab, setTab] = useState<"details" | "comments">("comments"); // opens straight on the conversation
  const tabClass = (on: boolean) => `rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`;
  return (
    <div className="flex flex-col gap-2 border-t border-border/70 px-3 py-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div role="tablist" aria-label={`${ticket.id} details and ${MESSAGES_LABEL.toLowerCase()}`} className="flex gap-1">
        <button type="button" role="tab" aria-selected={tab === "comments"} onClick={() => setTab("comments")} className={tabClass(tab === "comments")}>{MESSAGES_LABEL}</button>
        <button type="button" role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")} className={tabClass(tab === "details")}>Details</button>
      </div>
      <TabSwap id={tab}>
        {tab === "comments" ? (
          <TaskComments taskId={ticket.id} small />
        ) : (
          <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
            <dt className="text-muted">Created by</dt>
            <dd className="break-words">{ticket.createdBy ?? "–"}{ticket.createdByTeam ? ` · ${ticket.createdByTeam}` : ""}</dd>
            <dt className="text-muted">Assigned team</dt>
            <dd>{ticket.assignees ? ([...new Set(assigneePeople(ticket.assignees, users).map((p) => p.team).filter(Boolean))].join(", ") || ticket.assignedTeam || "No team") : "–"}</dd>
            <dt className="text-muted">Created</dt>
            <dd>{when(ticket.createdAt)}</dd>
            {ticket.description && (
              <>
                <dt className="text-muted">Description</dt>
                <dd className="line-clamp-3 whitespace-pre-line break-words">{ticket.description}</dd>
              </>
            )}
          </dl>
        )}
      </TabSwap>
    </div>
  );
}
