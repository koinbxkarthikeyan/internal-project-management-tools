"use client";

import { useState, type KeyboardEvent } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline } from "@/features/backlog/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { BacklogItemData } from "@/types/backlog";
import ViewTaskDrawer from "./ViewTaskDrawer";

const head = "px-4 py-2.5 text-left";

/** Tasks the signed-in user leads or is assigned to, plus tasks nobody is assigned to yet. Same page for Super Admin, Admin and users. */
export default function MyTaskPage() {
  const { items } = useBacklog();
  const { user } = useAuth();
  const [open, setOpen] = useState<BacklogItemData | null>(null);

  const me = (user?.name ?? "").toLowerCase();
  // Shown here: tasks I lead, tasks I'm assigned to, and tasks nobody is assigned to yet (no Lead and no assignees).
  // Tasks led by or assigned to someone else are not shown.
  // A task that was copied into the next sprint when its sprint closed is left out (the copy is the live one).
  const carried = new Set(items.flatMap((t) => (t.carriedFrom ? [t.carriedFrom] : [])));
  const mine = items.filter((t) => {
    if (carried.has(t.id)) return false;
    const assigned = (t.assignees ?? "")
      .split(",")
      .map((n) => n.trim().replace(/^@+/, "").trim().toLowerCase())
      .filter(Boolean);
    const lead = (t.lead ?? "").toLowerCase();
    return lead === me || assigned.includes(me) || (assigned.length === 0 && !lead);
  });

  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>, item: BacklogItemData) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(item);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Task"
        description={`${mine.length} ${mine.length === 1 ? "task" : "tasks"} for you. Click one to see its details.`}
      />
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {mine.length === 0 ? (
          <EmptyState title="No tasks for you yet" description="Tasks you lead or are assigned to, and unassigned ones, will show up here." />
        ) : (
          <div className="max-h-[20.5rem] overflow-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Tasks assigned to you</caption>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className={head}>ID</th>
                  <th scope="col" className={head}>Title</th>
                  <th scope="col" className={head}>Type</th>
                  <th scope="col" className={head}>Priority</th>
                  <th scope="col" className={head}>Status</th>
                  <th scope="col" className={head}>Sprint</th>
                  <th scope="col" className={head}>Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mine.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    onClick={() => setOpen(item)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    aria-label={`View ${item.id}: ${item.title}`}
                    className="cursor-pointer transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{item.id}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium">{item.title}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{item.type ?? "–"}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{item.sprint}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      <time dateTime={item.deadline}>{formatDeadline(item.deadline)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && <ViewTaskDrawer key={open.id} item={items.find((i) => i.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}
