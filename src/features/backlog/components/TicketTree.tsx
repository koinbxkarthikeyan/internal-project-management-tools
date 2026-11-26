"use client";

import { MESSAGES_LABEL } from "@/constants/work";
import AssigneeStack, { assigneePeople } from "@/components/ui/AssigneeStack";
import { useUsers } from "@/features/users/hooks/useUsers";
import { disclosureKeys } from "@/lib/disclosureKeys";
import { useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
import Collapse from "@/components/ui/Collapse";
import FitList from "@/components/ui/FitList";
import { PRIORITY_CARD, PRIORITY_ROW } from "../priorityCard";
import ReopenedBadge from "./ReopenedBadge";
import TicketMore from "./TicketMore";

/**
 * The Tickets as an expandable list for the List View's left side: each row has its id, title, status, priority and assignee, a button that selects it (the chosen
 * row is highlighted with an accent edge); its background takes the priority colour, as a card on the Board View does and a chevron that opens its details and its comments (TicketMore) without changing the selection.
 */
export default function TicketTree({ tickets, selectedId, onSelect }: { tickets: readonly BacklogItemData[]; selectedId?: string; onSelect: (ticket: BacklogItemData) => void }) {
    const users = useUsers();
const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  // One Ticket open at a time: opening another closes the open one.
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set() : new Set([id])));
  return (
    // The list scrolls inside, within the height of the screen, so many Tickets don't make the page long.
    <FitList className="flex flex-col gap-1.5 p-0.5 pr-1.5">
      {tickets.map((t) => {
        const selected = selectedId === t.id;
        const expanded = open.has(t.id);
        return (
          <li key={t.id} className={`rounded-lg border transition-colors ${selected ? `border-accent shadow-[inset_3px_0_0_0_var(--accent)] ${PRIORITY_ROW[t.priority]}` : PRIORITY_CARD[t.priority]}`}>
            <div className="flex items-start gap-1 p-1.5">
              <button
                type="button"
                onClick={() => toggle(t.id)}
                onKeyDown={disclosureKeys(expanded, () => toggle(t.id))}
                data-disclosure
                aria-expanded={expanded}
                aria-label={`${expanded ? "Hide" : "Show"} ${MESSAGES_LABEL.toLowerCase()} and details of ${t.id}`}
                title={expanded ? `Hide ${MESSAGES_LABEL.toLowerCase()} and details` : `${MESSAGES_LABEL} and details`}
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${expanded ? "rotate-90" : ""}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" onClick={() => onSelect(t)} aria-current={selected ? "true" : undefined} className="flex min-w-0 flex-1 flex-col gap-1 rounded-md px-1 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-accent">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted">{t.id}</span>
                  <ReopenedBadge item={t} />
                </span>
                <span className="break-words text-sm font-medium">{t.title}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <span className="ml-auto">
                    <AssigneeStack passive people={assigneePeople(t.assignees, users)} size={22} />
                  </span>
                </span>
              </button>
            </div>
            <Collapse open={expanded}><TicketMore ticket={t} /></Collapse>
          </li>
        );
      })}
    </FitList>
  );
}
