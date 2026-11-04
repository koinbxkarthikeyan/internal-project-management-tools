"use client";

import { useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
import ReopenedBadge from "./ReopenedBadge";

const when = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "–";
};

/**
 * The Tickets as an expandable list for the List View's left side: each row has its id, title, status, priority and assignee, a button that selects it (the chosen
 * row is highlighted) and a chevron that opens a short summary (who created it and their team, the assigned team, the date) without changing the selection.
 */
export default function TicketTree({ tickets, selectedId, onSelect }: { tickets: readonly BacklogItemData[]; selectedId?: string; onSelect: (ticket: BacklogItemData) => void }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));
  return (
    <ul className="flex flex-col gap-1.5">
      {tickets.map((t) => {
        const selected = selectedId === t.id;
        const expanded = open.has(t.id);
        return (
          <li key={t.id} className={`rounded-lg border transition-colors ${selected ? "border-accent bg-accent-soft/50 shadow-[inset_3px_0_0_0_var(--accent)]" : "border-border bg-background hover:border-accent/60"}`}>
            <div className="flex items-start gap-1 p-1.5">
              <button
                type="button"
                onClick={() => toggle(t.id)}
                aria-expanded={expanded}
                aria-label={`${expanded ? "Hide" : "Show"} summary of ${t.id}`}
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${expanded ? "rotate-90" : ""}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" onClick={() => onSelect(t)} aria-current={selected ? "true" : undefined} className="flex min-w-0 flex-1 flex-col gap-1 rounded-md px-1 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-accent">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-muted">{t.id}</span>
                  <ReopenedBadge item={t} />
                </span>
                <span className="break-words text-sm font-medium">{t.title}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </span>
                <span className="truncate text-[11px] text-muted">{t.assignees || "Unassigned"}{t.assignees && t.assignedTeam ? ` · ${t.assignedTeam}` : ""}</span>
              </button>
            </div>
            {expanded && (
              <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-border px-3 py-2 text-[11px]">
                <dt className="text-muted">Created by</dt>
                <dd className="break-words">{t.createdBy ?? "–"}{t.createdByTeam ? ` · ${t.createdByTeam}` : ""}</dd>
                <dt className="text-muted">Assigned team</dt>
                <dd>{t.assignees ? (t.assignedTeam ?? "No team") : "–"}</dd>
                <dt className="text-muted">Created</dt>
                <dd>{when(t.createdAt)}</dd>
                {t.description && (
                  <>
                    <dt className="text-muted">Description</dt>
                    <dd className="line-clamp-3 whitespace-pre-line break-words">{t.description}</dd>
                  </>
                )}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
