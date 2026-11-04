"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { statusLabel } from "@/constants/backlog-options";
import { MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import ViewTaskDrawer from "@/features/work/components/ViewTaskDrawer";
import type { BacklogItemData, Status } from "@/types/backlog";
import { statusOptionsFor } from "../statusOptions";
import { NO_TICKET_FILTERS, filterTickets, type TicketFilters, type TicketGroupBy } from "../ticketFilters";
import QaTaskSummary from "./QaTaskSummary";
import TaskTickets from "./TaskTickets";
import TicketFilterBar from "./TicketFilterBar";

export type WorkspaceView = "list" | "board";

/**
 * The Main Task page's two interchangeable layouts over the same task and Tickets (nothing is copied when switching: both read the same records).
 * List View: the filters full width on top, the Tickets as an expandable list on the left, the task's details and comments on the right.
 * Board View: the status board on top (cards can be dragged to another column), the task's details underneath. A Ticket opens as its own full page.
 * The selected Ticket, the filters and the search live here, so they stay as they are when the view is switched.
 */
export default function TaskWorkspace({ item, view, selectedCode, canCreate, compact, canChangeStatus, onChanged, onBack }: { item: BacklogItemData; view: WorkspaceView; selectedCode: string | null; canCreate: boolean; /** Show the task's short details (with its comments) instead of the full task panel: on the QA pages and once a task is with QA. */ compact: boolean; /** The QA team and the admins may change the task's status here (once all Tickets are Done). */ canChangeStatus: boolean; onChanged: () => void; onBack: () => void }) {
  const toast = useToast();
  const { user, isQa, isAdmin } = useAuth();
  // The search and filters are kept for this task while the tab is open, so they are still there after opening a Ticket and coming back.
  const filterKey = `koinbx.ticketFilters.${item.id}`;
  const [filters, setFilters] = useState<TicketFilters>(() => {
    try {
      const saved = sessionStorage.getItem(filterKey);
      return saved ? { ...NO_TICKET_FILTERS, ...(JSON.parse(saved) as Partial<TicketFilters>) } : NO_TICKET_FILTERS;
    } catch {
      return NO_TICKET_FILTERS;
    }
  });
  const changeFilters = (f: TicketFilters) => {
    setFilters(f);
    try {
      sessionStorage.setItem(filterKey, JSON.stringify(f));
    } catch {
      /* the filters just are not kept */
    }
  };
  // The grouping of the Tickets (by team) is kept for this task, like the filters, and shared by both layouts.
  const groupKey = `koinbx.ticketGroup.${item.id}`;
  const [groupBy, setGroupBy] = useState<TicketGroupBy>(() => {
    try {
      const v = sessionStorage.getItem(groupKey);
      return v === "assigned" || v === "created" ? v : "";
    } catch {
      return "";
    }
  });
  const changeGroup = (g: TicketGroupBy) => {
    setGroupBy(g);
    try {
      sessionStorage.setItem(groupKey, g);
    } catch {
      /* not kept */
    }
  };
  const [tickets, setTickets] = useState<BacklogItemData[] | null>(null);
  // Bumped when a Ticket is made from the comments section, so the Tickets block reads its list again.
  const [ticketsToken, setTicketsToken] = useState(0);

  // A Ticket opens as its own full page; coming back to the task keeps it marked.
  const router = useRouter();
  const area = usePathname().startsWith(MY_TASK_HREF) ? MY_TASK_HREF : READY_FOR_QA_HREF;
  const open = (t: BacklogItemData, status?: Status) => router.push(`${area}/ticket?id=${t.apiId}${status ? `&status=${encodeURIComponent(status)}` : ""}`);
  const selected = selectedCode && tickets ? (tickets.find((t) => t.id === selectedCode) ?? null) : null;

  function move(t: BacklogItemData, to: Status) {
    const mine = !!user && (t.assigneeIds ?? []).includes(user.id);
    if (t.status === "Done") return toast.show("Use Reopen to change a completed Ticket.", "danger");
    const creator = !!user && t.createdById === user.id;
    if (!(isQa || isAdmin || mine || creator) || !statusOptionsFor(t, isAdmin, isAdmin || isQa, creator).some((o) => o.value === to)) return toast.show(`You can't move ${t.id} to ${statusLabel(to)}.`, "danger");
    toast.show(`Write the comment for moving ${t.id} to ${statusLabel(to)}, then press Save status.`, "info");
    open(t, to);
  }

  const ticketsBlock = (variant: "tree" | "board") => (
    <TaskTickets
      task={item}
      canCreate={canCreate}
      reloadToken={ticketsToken}
      variant={variant}
      selectedId={selected?.id}
      filters={filters}
      groupBy={groupBy}
      onTickets={setTickets}
      onOpen={(t) => open(t)}
      onMove={variant === "board" ? move : undefined}
      onChanged={onChanged}
    />
  );

  const taskPanel = compact ? (
    <QaTaskSummary task={item} tickets={tickets} canChangeStatus={canChangeStatus} canCreate={canCreate} onTicketCreated={() => setTicketsToken((n) => n + 1)} onChanged={onChanged} />
  ) : (
    <ViewTaskDrawer key={`${item.id}:${item.status}`} inline item={item} onClose={onBack} onSaved={onChanged} />
  );

  // The search and filters sit above the Tickets block, outside it, in both layouts.
  const filterBar =
    tickets && tickets.length > 0 ? (
      <div className="-mt-3">
        <TicketFilterBar tickets={tickets} filters={filters} onChange={changeFilters} shown={filterTickets(tickets, filters).length} groupBy={groupBy} onGroupBy={changeGroup} />
      </div>
    ) : null;

  if (view === "board") {
    return (
      <div className="flex flex-col gap-4">
        {filterBar}
        {/* The status board takes the width; the task's comments are a narrow column beside it (under it on a small screen). */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0">{ticketsBlock("board")}</div>
          <div className="min-w-0 lg:sticky lg:top-4">{taskPanel}</div>
        </div>
      </div>
    );
  }
  // List View: the filters on top, the Tickets on the left, the task's details or comments on the right.
  return (
    <div className="flex flex-col gap-4">
      {filterBar}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">{ticketsBlock("tree")}</div>
        <div className="min-w-0">{taskPanel}</div>
      </div>
    </div>
  );
}
