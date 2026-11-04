"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "@/components/ui/icons";
import { getErrorMessage } from "@/lib/apiClient";
import { onExternalChange } from "@/lib/localApi";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Status } from "@/types/backlog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { refreshTicketViews } from "../ticketRefresh";
import { useBacklog } from "../context/BacklogContext";
import CreateTicketDrawer from "./CreateTicketDrawer";
import TicketBoard from "./TicketBoard";
import TicketTree from "./TicketTree";
import { NO_TICKET_FILTERS, filterTickets, groupTickets, type TicketFilters, type TicketGroupBy } from "../ticketFilters";

/**
 * The Tickets under one task, shown inside that task: each with its code, title, status, priority and assignee, and a Create Ticket button for the people
 * who may add them (QA, Super Admin, enabled Admins). The task itself is the parent: no separate Bug record or heading is involved.
 */
export default function TaskTickets({ task, canCreate = false, variant, selectedId, filters: controlled, groupBy: controlledGroup, onMove, onTickets, onOpen, onChanged, reloadToken = 0 }: { task: BacklogItemData; /** Offers the Create Ticket button (the people who may add Tickets). */ canCreate?: boolean; /** How the Tickets are laid out: the default block (with its own Board / List switch), the expandable list of the List View, or the board of the Board View (cards can be dragged when `onMove` is given). */ variant: "tree" | "board"; /** The Ticket whose details are showing (marked in the list and on the board). */ selectedId?: string; /** The filters, when the page keeps them (so both layouts share them); otherwise this block keeps its own. */ filters?: TicketFilters; /** The grouping, when the page keeps it (so the filter row can sit above both columns). */ groupBy?: TicketGroupBy; onMove?: (ticket: BacklogItemData, to: Status) => void; /** Leave the whole block out when there is nothing to show and nobody can add one. */ hideWhenEmpty?: boolean; /** Told how many Tickets the task has, each time they are read. */ /** Show the Tickets as a board (a column per status: To Do, In Progress, Ready for QA, Testing, Done, each with its count) instead of one list. */ board?: boolean; onCount?: (count: number) => void; /** Given the Tickets each time they are read. */ onTickets?: (tickets: BacklogItemData[]) => void; /** Opens a Ticket's details (to change its status, for example). */ onOpen?: (ticket: BacklogItemData) => void; /** Changes when the Tickets should be read again (a Ticket was saved elsewhere). */ reloadToken?: number; /** Called after a Ticket was created (creating one can change who the task is assigned to). */ onChanged?: () => void }) {
  const [tickets, setTickets] = useState<BacklogItemData[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const { refreshItems } = useBacklog();
  const { user } = useAuth();
  // Filters and grouping come from the Main Task page, which has the filter row; everywhere else (the task panel and drawer) the Tickets are shown unfiltered and ungrouped.
  const filters = controlled ?? NO_TICKET_FILTERS;
  const groupBy = controlledGroup ?? "";

  const load = useCallback(() => {
    backlogService.getTickets(task.id).then(
      (rows) => (setTickets(rows), setError(""), onTickets?.(rows)),
      (err) => setError(getErrorMessage(err)),
    );
    // `onCount` and `onTickets` only report; a new function each render must not read the Tickets again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);
  useEffect(load, [load, task.status, reloadToken]);
  useEffect(() => onExternalChange(load), [load]);

  // The filters read the Tickets as they are now: a Ticket created, edited or reassigned is read again (load) and is filtered at once.
  const shown = tickets ? filterTickets(tickets, filters) : [];
  const groups = groupTickets(shown, groupBy);
  const listOf = (list: BacklogItemData[]) =>
    variant === "tree" ? (
      <TicketTree tickets={list} selectedId={selectedId} onSelect={(t) => onOpen?.(t)} />
    ) : (
      <TicketBoard tickets={list} onOpen={onOpen} selectedId={selectedId} onMove={onMove} />
    );

  if (task.type === "Ticket") return null;

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">
          Tickets{tickets && tickets.length > 0 ? ` · ${tickets.length} (${tickets.filter((t) => t.status === "Done").length} done)` : ""}
        </p>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            <PlusIcon width={14} height={14} /> Create Ticket
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>
      ) : tickets === null ? (
        <p className="mt-2 text-xs text-muted" role="status">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No Tickets yet.</p>
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="mt-3 text-xs text-muted">No Tickets match these filters.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {groups.map((g) => (
                <section key={g.key || "all"} aria-label={g.name ? `Team ${g.name}, ${g.tickets.length}` : undefined} className="flex flex-col gap-2">
                  {g.name && (
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      {g.name} <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium">{g.tickets.length}</span>
                    </h3>
                  )}
                  {listOf(g.tickets)}
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {/* In the page itself (not inside a form this block may sit in): a form can't hold a form. */}
      {creating && typeof document !== "undefined" && createPortal(
        <CreateTicketDrawer
          task={task}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
            // A QA member creating a Ticket is added to the task (and a first Ticket moves it to Testing): the lists, My Task and the page it was made on all read the task again.
            refreshItems();
            if (user) refreshTicketViews(user.id);
            onChanged?.();
          }}
        />,
        document.body,
      )}
    </div>
  );
}
