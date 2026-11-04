"use client";

import { useMemo } from "react";
import { SearchableSelect } from "@/components/ui/FormControls";
import { PRIORITIES, STATUSES, statusLabel } from "@/constants/backlog-options";
import type { BacklogItemData, Priority, Status } from "@/types/backlog";
import BacklogSearch from "./BacklogSearch";
import { GROUP_OPTIONS, NO_TICKET_FILTERS, isFiltering, ticketAssigneeId, type TicketFilters, type TicketGroupBy } from "../ticketFilters";

/**
 * Search and filters for a task's Tickets: by Ticket id or title, then the choice to group them by team, then Created By, Assigned To, Status and Priority, all combining.
 * People are the creators and assignees of the listed Tickets. Values are ids, so a differently spelled name never splits a person.
 */
export default function TicketFilterBar({ tickets, filters, onChange, shown, groupBy, onGroupBy }: { tickets: readonly BacklogItemData[]; filters: TicketFilters; onChange: (f: TicketFilters) => void; shown: number; groupBy: TicketGroupBy; onGroupBy: (g: TicketGroupBy) => void }) {
  const set = (patch: Partial<TicketFilters>) => onChange({ ...filters, ...patch });

  const creators = useMemo(() => [...new Map(tickets.flatMap((t) => (t.createdById && t.createdBy ? [[t.createdById, t.createdBy] as const] : []))).entries()], [tickets]);
  const assignees = useMemo(
    () => [...new Map(tickets.flatMap((t) => (ticketAssigneeId(t) && t.assignees ? [[ticketAssigneeId(t), t.assignees.split(", ")[0]] as const] : []))).entries()],
    [tickets],
  );

  const grow = "min-w-0 flex-1 basis-32 sm:flex-none sm:basis-40";
  return (
    <section aria-label="Filter Tickets" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5">
      <BacklogSearch value={filters.search} onChange={(search) => set({ search })} placeholder="Search Ticket ID or title…" ariaLabel="Search Tickets" />
      <SearchableSelect ariaLabel="Group Tickets by team" value={groupBy} onChange={(v) => onGroupBy(v as TicketGroupBy)} options={GROUP_OPTIONS.filter((o) => o.value).map((o) => ({ value: o.value, label: o.label }))} placeholder="No grouping" className={grow} />
      <SearchableSelect ariaLabel="Filter by Created By" value={filters.createdBy} onChange={(v) => set({ createdBy: v })} options={[...creators.map(([value, label]) => ({ value, label }))]} placeholder="Created By: All" className={grow} />
      <SearchableSelect ariaLabel="Filter by Assigned To" value={filters.assignedTo} onChange={(v) => set({ assignedTo: v })} options={[...assignees.map(([value, label]) => ({ value, label }))]} placeholder="Assigned To: All" className={grow} />
      <SearchableSelect ariaLabel="Filter by Status" value={filters.status} onChange={(v) => set({ status: v as "" | Status })} options={[...STATUSES.filter((st) => st !== "Ready for QA").map((st) => ({ value: st, label: statusLabel(st) }))]} placeholder="Status: All" className={grow} />
      <SearchableSelect ariaLabel="Filter by Priority" value={filters.priority} onChange={(v) => set({ priority: v as "" | Priority })} options={[...PRIORITIES.map((p) => ({ value: p, label: p }))]} placeholder="Priority: All" className={grow} />
      {isFiltering(filters) && (
        <>
          <button type="button" onClick={() => onChange(NO_TICKET_FILTERS)} className="h-10 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">Clear</button>
          <p role="status" className="basis-full text-[11px] text-muted">Showing {shown} of {tickets.length} Tickets</p>
        </>
      )}
    </section>
  );
}
