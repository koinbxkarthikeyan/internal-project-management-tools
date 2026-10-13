"use client";

import { useState, type KeyboardEvent } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useQueryState } from "@/hooks/useQueryState";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline } from "@/features/backlog/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { BacklogItemData } from "@/types/backlog";
import ViewTaskDrawer from "./ViewTaskDrawer";

const head = "px-4 py-2.5 text-left";

type Tab = "mine" | "lead";
const TABS: { id: Tab; label: string }[] = [
  { id: "mine", label: "My Tasks" },
  { id: "lead", label: "My Lead Tasks" },
];

/**
 * My Tasks: tasks where I am one of the Assigned Users. My Lead Tasks: tasks where I am the Lead. Being the Owner is not
 * enough for either. Who "I" am is decided by user id (with the name only as a fallback when the backend sent no id).
 */
export default function MyTaskPage() {
  const { items } = useBacklog();
  const { user } = useAuth();
  const [open, setOpen] = useState<BacklogItemData | null>(null);
  const [tab, setTab] = useQueryState<Tab>("tab", ["mine", "lead"], "mine");

  const myId = user?.id ?? "";
  const myName = (user?.name ?? "").toLowerCase();
  const nameList = (t: BacklogItemData) =>
    (t.assignees ?? "")
      .split(",")
      .map((n) => n.trim().replace(/^@+/, "").trim().toLowerCase())
      .filter(Boolean);
  const isLead = (t: BacklogItemData) => (t.leadId ? t.leadId === myId : !!t.lead && t.lead.toLowerCase() === myName);
  const isAssigned = (t: BacklogItemData) => (t.assigneeIds?.length ? t.assigneeIds.includes(myId) : nameList(t).includes(myName));

  // A task that was copied into the next sprint when its sprint closed is left out (the copy is the live one).
  const carried = new Set(items.flatMap((t) => (t.carriedFrom ? [t.carriedFrom] : [])));
  const live = items.filter((t) => !carried.has(t.id));
  const lists: Record<Tab, BacklogItemData[]> = {
    mine: live.filter(isAssigned),
    lead: live.filter(isLead),
  };
  const shown = lists[tab];
  const leadTab = tab === "lead";

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
        description={`${shown.length} ${shown.length === 1 ? "task" : "tasks"} ${leadTab ? "you lead" : "assigned to you"}. Click one to see its details.`}
      />
      <div role="tablist" aria-label="Task lists" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? "bg-accent text-accent-foreground" : "bg-hover text-muted"}`}>{lists[t.id].length}</span>
            </button>
          );
        })}
      </div>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {shown.length === 0 ? (
          <EmptyState
            title={leadTab ? "No lead tasks yet" : "No tasks for you yet"}
            description={leadTab ? "Tasks where you are the Lead will show up here." : "Tasks where you are an Assigned User will show up here."}
          />
        ) : (
          <div className="max-h-[20.5rem] overflow-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">{leadTab ? "Tasks you lead" : "Tasks assigned to you"}</caption>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className={head}>ID</th>
                  <th scope="col" className={head}>Title</th>
                  <th scope="col" className={head}>Type</th>
                  <th scope="col" className={head}>Priority</th>
                  <th scope="col" className={head}>Status</th>
                  <th scope="col" className={head}>Sprint</th>
                  <th scope="col" className={head}>{leadTab ? "Expected deadline" : "Deadline"}</th>
                  {leadTab && <th scope="col" className={head}>Lead Deadline</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((item) => (
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
                    {leadTab && (
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {item.leadDeadline ? <time dateTime={item.leadDeadline}>{formatDeadline(item.leadDeadline)}</time> : "–"}
                      </td>
                    )}
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
