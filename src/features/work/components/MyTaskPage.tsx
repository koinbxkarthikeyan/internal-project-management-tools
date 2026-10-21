"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { DisabledTip } from "@/components/ui/DisabledTip";
import EmptyState from "@/components/ui/EmptyState";
import { useQueryState } from "@/hooks/useQueryState";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline } from "@/features/backlog/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyTasksStore } from "@/stores/myTasksStore";
import type { BacklogItemData } from "@/types/backlog";
import ViewTaskDrawer from "./ViewTaskDrawer";

const head = "px-4 py-2.5 text-left";

type Tab = "mine" | "lead" | "unassigned";
const TABS: { id: Tab; label: string }[] = [
  { id: "mine", label: "My Tasks" },
  { id: "lead", label: "My Lead Tasks" },
  { id: "unassigned", label: "Unassigned" },
];

/**
 * My Tasks: tasks where I am one of the Assigned Users. My Lead Tasks: tasks where I am the Lead. Being the Owner is not
 * enough for either. Who "I" am is decided by user id (with the name only as a fallback when the backend sent no id).
 */
export default function MyTaskPage() {
  const { items: shared } = useBacklog();
  const { user } = useAuth();
  const [open, setOpen] = useState<BacklogItemData | null>(null);
  const [tab, setTab] = useQueryState<Tab>("tab", ["mine", "lead", "unassigned"], "mine");

  // The three lists come from `GET /items/mine` (lead, assigned, unassigned). Each task is shown as its newest copy from the shared
  // list, so a saved change shows at once; a task in several lists appears once in each.
  const mineStore = useMyTasksStore();
  const scope = user?.id ?? "";
  const { load: loadMine } = mineStore;
  useEffect(() => {
    if (scope) void loadMine(scope);
  }, [scope, loadMine]);
  const mineReady = mineStore.scope === scope && mineStore.status === "ready";
  const mineFailed = mineStore.scope === scope && mineStore.status === "error";
  const fresh = (list: BacklogItemData[]) => list.map((m) => shared.find((s) => s.id === m.id) ?? m);
  const all = [...mineStore.buckets.lead, ...mineStore.buckets.assigned, ...mineStore.buckets.unassigned];

  // A task that was copied into the next sprint when its sprint closed is left out (the copy is the live one).
  const carried = new Set([...shared, ...all].flatMap((t) => (t.carriedFrom ? [t.carriedFrom] : [])));
  const lists: Record<Tab, BacklogItemData[]> = {
    mine: fresh(mineStore.buckets.assigned).filter((t) => !carried.has(t.id)),
    lead: fresh(mineStore.buckets.lead).filter((t) => !carried.has(t.id)),
    unassigned: fresh(mineStore.buckets.unassigned).filter((t) => !carried.has(t.id)),
  };
  // Every tab stays visible; one with no tasks is disabled. The tab that is open is the chosen one while it has tasks, otherwise the first
  // tab (in tab order) that has some, so a page never opens on an empty tab while another has tasks. With no tasks anywhere it stays on My Tasks.
  const emptyTab = (id: Tab) => lists[id].length === 0;
  const activeTab: Tab = !emptyTab(tab) ? tab : (TABS.find((t) => !emptyTab(t.id))?.id ?? "mine");
  const shown = lists[activeTab];
  const COPY: Record<Tab, { noun: string; title: string; description: string; caption: string }> = {
    mine: { noun: "assigned to you", title: "No tasks for you yet", description: "Tasks where you are an Assigned User will show up here.", caption: "Tasks assigned to you" },
    lead: { noun: "you lead", title: "No lead tasks yet", description: "Tasks where you are the Lead will show up here.", caption: "Tasks you lead" },
    unassigned: { noun: "not assigned to anyone", title: "No unassigned tasks", description: "Tasks nobody is assigned to will show up here.", caption: "Tasks not assigned to anyone" },
  };
  const copy = COPY[activeTab];

  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>, item: BacklogItemData) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(item);
    }
  }

  if (mineFailed) {
    return (
      <section role="alert" className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-base font-semibold">Couldn&apos;t load your tasks</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">{mineStore.error}</p>
        <button
          type="button"
          onClick={() => void loadMine(scope, true)}
          className="mt-4 rounded-xl btn-brand px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </section>
    );
  }
  if (!mineReady) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Task"
        description={`${shown.length} ${shown.length === 1 ? "task" : "tasks"} ${copy.noun}. Click one to see its details.`}
      />
      <div role="tablist" aria-label="Task lists" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const disabled = emptyTab(t.id);
          return (
            <DisabledTip key={t.id} reason={disabled && (t.id === "mine" ? "No task is assigned to you." : t.id === "lead" ? "You don't lead any task yet." : "There are no unassigned tasks.")} className="inline-block">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-accent-soft font-medium text-accent" : disabled ? "cursor-not-allowed text-muted opacity-50" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? "bg-[#425df3] font-semibold text-white dark:bg-accent dark:text-accent-foreground" : "bg-hover text-muted"}`}>{lists[t.id].length}</span>
            </button>
            </DisabledTip>
          );
        })}
      </div>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {shown.length === 0 ? (
          <EmptyState title={copy.title} description={copy.description} />
        ) : (
          <div className="max-h-[20.5rem] overflow-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <caption className="sr-only">{copy.caption}</caption>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className={head}>Title</th>
                  <th scope="col" className={head}>Type</th>
                  <th scope="col" className={head}>Priority</th>
                  <th scope="col" className={head}>Status</th>
                  <th scope="col" className={head}>Sprint</th>
                  <th scope="col" className={head}>Expected deadline</th>
                  <th scope="col" className={head}>Lead Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    onClick={() => setOpen(item)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    aria-label={`View ${item.title}`}
                    className="cursor-pointer transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                  >
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
                      {item.deadline ? <time dateTime={item.deadline}>{formatDeadline(item.deadline)}</time> : "–"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {item.leadDeadline ? <time dateTime={item.leadDeadline}>{formatDeadline(item.leadDeadline)}</time> : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && <ViewTaskDrawer key={open.id} item={shared.find((i) => i.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}
