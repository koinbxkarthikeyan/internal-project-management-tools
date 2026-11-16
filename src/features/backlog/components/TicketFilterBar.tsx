"use client";

import { useMemo } from "react";
import FilterBar, { FilterPill } from "@/components/ui/FilterBar";
import { PRIORITIES, STATUSES, statusLabel } from "@/constants/backlog-options";
import type { BacklogItemData, Priority, Status } from "@/types/backlog";
import BacklogSearch from "./BacklogSearch";
import { GROUP_OPTIONS, NO_TICKET_FILTERS, isFiltering, ticketAssignees, type TicketFilters, type TicketGroupBy } from "../ticketFilters";

/**
 * Search and filters for a task's Tickets: by Ticket id or title, then the choice to group them by team, then Created By, Assigned To, Status and Priority, all combining.
 * People are the creators and assignees of the listed Tickets. Values are ids, so a differently spelled name never splits a person.
 */
export default function TicketFilterBar({ tickets, filters, onChange, shown, groupBy, onGroupBy }: { tickets: readonly BacklogItemData[]; filters: TicketFilters; onChange: (f: TicketFilters) => void; shown: number; groupBy: TicketGroupBy; onGroupBy: (g: TicketGroupBy) => void }) {
  const set = (patch: Partial<TicketFilters>) => onChange({ ...filters, ...patch });

  const creators = useMemo(() => [...new Map(tickets.flatMap((t) => (t.createdById && t.createdBy ? [[t.createdById, t.createdBy] as const] : []))).entries()], [tickets]);
  const assignees = useMemo(
    () => [...new Map(tickets.flatMap((t) => ticketAssignees(t))).entries()],
    [tickets],
  );

  return (
    <div className="mt-3">
      <FilterBar
        label="Filter Tickets"
        search={<BacklogSearch value={filters.search} onChange={(search) => set({ search })} placeholder="Search Ticket ID or title…" ariaLabel="Search Tickets" />}
        activeCount={Object.values(filters).filter(Boolean).length}
        onClear={() => onChange(NO_TICKET_FILTERS)}
        count={isFiltering(filters) ? { shown, total: tickets.length } : undefined}
      >
        <FilterPill label="Group" value={groupBy} onChange={(v) => onGroupBy(v as TicketGroupBy)} options={GROUP_OPTIONS.filter((o) => o.value).map((o) => ({ value: o.value, label: o.label }))} />
        <FilterPill label="Created By" value={filters.createdBy} onChange={(v) => set({ createdBy: v })} options={creators.map(([value, label]) => ({ value, label }))} />
        <FilterPill label="Assigned To" value={filters.assignedTo} onChange={(v) => set({ assignedTo: v })} options={assignees.map(([value, label]) => ({ value, label }))} />
        <FilterPill label="Status" value={filters.status} onChange={(v) => set({ status: v as "" | Status })} options={STATUSES.filter((st) => st !== "Ready for QA").map((st) => ({ value: st, label: statusLabel(st) }))} />
        <FilterPill label="Priority" value={filters.priority} onChange={(v) => set({ priority: v as "" | Priority })} options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
      </FilterBar>
    </div>
  );
}
