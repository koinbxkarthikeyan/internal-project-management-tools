"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { PRIORITIES, STATUSES, statusLabel } from "@/constants/backlog-options";
import { useBacklog } from "../context/BacklogContext";
import { formatDeadline } from "../utils";
import BacklogSummary from "./BacklogSummary";

function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="anim-fade-up rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.every((r) => r.value === 0) ? (
        <EmptyState compact title="No data yet" description="Add backlog items to see this breakdown." />
      ) : (
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 text-muted">{r.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-hover" aria-hidden="true">
              <span
                className="anim-grow-x block h-full rounded-full bg-accent"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </span>
            <span className="w-6 text-right tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}

export default function OverviewPage({ tabs }: { /** Shown in the page header (a Super Admin / Admin switching between Team and Personal). */ tabs?: ReactNode } = {}) {
  const { items } = useBacklog();
  const upcoming = items
    .filter((i) => i.status !== "Completed")
    .toSorted((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" description="A snapshot of backlog health across all sprints." actions={tabs} />
      <BacklogSummary items={items} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="By status"
          rows={STATUSES.map((s) => ({ label: statusLabel(s), value: items.filter((i) => i.status === s).length }))}
        />
        <Breakdown
          title="By priority"
          rows={PRIORITIES.map((p) => ({ label: p, value: items.filter((i) => i.priority === p).length }))}
        />
      </div>

      <section style={{ "--i": 3 } as CSSProperties} className="anim-fade-up overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Upcoming deadlines</h2>
          <Link href="/all-items" className="text-sm text-accent hover:underline">
            View all items
          </Link>
        </div>
        {upcoming.length === 0 && (
          <EmptyState compact title="No upcoming deadlines" description="Items with a deadline will appear here." />
        )}
        <ul className="divide-y divide-border">
          {upcoming.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-medium">{i.title}</p>
                <p className="text-xs text-muted">{i.owner}</p>
              </div>
              <PriorityBadge priority={i.priority} />
              <StatusBadge status={i.status} />
              <time dateTime={i.deadline} className="w-24 text-sm text-muted">
                {formatDeadline(i.deadline)}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
