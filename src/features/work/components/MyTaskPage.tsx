"use client";

import { TaskAssignees } from "@/components/ui/AssigneeStack";
import { Fragment, useEffect, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { useTabKeys } from "@/hooks/useTabKeys";
import { PriorityBadge, StatusBadge, TypeLabel } from "@/components/ui/Badge";
import { DisabledTip } from "@/components/ui/DisabledTip";
import EmptyState from "@/components/ui/EmptyState";
import { useQueryState } from "@/hooks/useQueryState";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline } from "@/features/backlog/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyTasksStore } from "@/stores/myTasksStore";
import type { BacklogItemData } from "@/types/backlog";
import ViewTaskDrawer from "./ViewTaskDrawer";
import MyTaskBoard from "./MyTaskBoard";
import TaskPopover from "./TaskPopover";
import { ChevronRightIcon, ListIcon } from "@/components/ui/icons";
import { sprintLabel, statusLabel } from "@/constants/backlog-options";

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
  const { items: shared, activeSprint, leadUpdateItem } = useBacklog();
  const { user } = useAuth();
  const [open, setOpenTask] = useState<BacklogItemData | null>(null);
  const setOpen = setOpenTask;
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const taskParam = useSearchParams().get("task");
  const [tab, setTab] = useQueryState<Tab>("tab", ["mine", "lead", "unassigned"], "mine");
  // The task whose details popup is open, and the arrow it hangs from (one at a time).
  const [pop, setPop] = useState<{ item: BacklogItemData; anchor: HTMLElement } | null>(null);
  // The popup hangs from the whole row / card (so it opens below the task, not over it), not from the small arrow.
  const showDetails = (item: BacklogItemData, arrow: HTMLElement) => setPop((cur) => (cur?.item.id === item.id ? null : { item, anchor: arrow.closest<HTMLElement>("tr[data-task]") ?? arrow }));
  const [view, setView] = useQueryState<"list" | "board">("view", ["list", "board"], "list");

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

  // A notification opens its task as `/my-task?task=<code>`: it opens (only if this person can see it) and the code is then taken out of the address.
  const linked = taskParam && mineReady ? (shared.find((t) => t.id === taskParam) ?? all.find((t) => t.id === taskParam) ?? null) : null;
  useEffect(() => {
    if (!taskParam || !mineReady) return;
    router.replace(pathname, { scroll: false });
    if (!linked) toast.show("That task isn't available to you, or it no longer exists.", "info");
    // Only the address and the load decide when this runs; the code is read once and then removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskParam, mineReady]);
  // The task is picked up once per code (state set while rendering, so it survives the code leaving the address).
  const [pickedUp, setPickedUp] = useState<string | null>(null);
  if (taskParam && mineReady && pickedUp !== taskParam) {
    setPickedUp(taskParam);
    if (linked) setOpen(linked);
  }

  // A task that was copied into the next sprint when its sprint closed is left out (the copy is the live one).
  const carried = new Set([...shared, ...all].flatMap((t) => (t.carriedFrom ? [t.carriedFrom] : [])));
  // Only the running sprint's tasks: none from planned, paused, closed or earlier sprints, and no Backlog tasks. It follows the sprint now running and each task's current sprint.
  const live = (t: BacklogItemData) => !carried.has(t.id) && !!activeSprint && t.sprint === activeSprint.name;
  const lists: Record<Tab, BacklogItemData[]> = {
    mine: fresh(mineStore.buckets.assigned).filter(live),
    lead: fresh(mineStore.buckets.lead).filter(live),
    unassigned: fresh(mineStore.buckets.unassigned).filter(live),
  };
  // Every tab stays visible; one with no tasks is disabled. The tab that is open is the chosen one while it has tasks, otherwise the first
  // tab (in tab order) that has some, so a page never opens on an empty tab while another has tasks. With no tasks anywhere it stays on My Tasks.
  const emptyTab = (id: Tab) => lists[id].length === 0;
  const activeTab: Tab = !emptyTab(tab) ? tab : (TABS.find((t) => !emptyTab(t.id))?.id ?? "mine");
  useTabKeys(TABS.map((t) => ({ id: t.id, disabled: emptyTab(t.id) })), (id) => setTab(id as Tab));
  const shown = lists[activeTab];
  // Every task here is in the running sprint, so a task in my own lists can be moved by me, whether I lead it or am only one of its assigned users (the list's own "read only" flag is not used for these).
  const canMove = (t: BacklogItemData) => {
    if (!user) return false;
    if (activeTab === "mine" || activeTab === "lead") return true;
    if (t.readOnly) return false;
    const lead = t.canLeadEdit ?? (!!t.lead && t.lead.toLowerCase() === user.name.toLowerCase());
    const assigned = (t.assigneeIds ?? []).map(String).includes(String(user.id)) || (t.assignees ?? "").split(",").some((n) => n.trim().toLowerCase() === user.name.toLowerCase());
    return lead || assigned;
  };

  const COPY: Record<Tab, { noun: string; title: string; description: string; caption: string }> = {
    mine: { noun: "assigned to you", title: "No tasks for you yet", description: "Tasks where you are an Assigned User will show up here.", caption: "Tasks assigned to you" },
    lead: { noun: "you lead", title: "No lead tasks yet", description: "Tasks where you are the Lead will show up here.", caption: "Tasks you lead" },
    unassigned: { noun: "not assigned to anyone", title: "No unassigned tasks", description: "Tasks nobody is assigned to will show up here.", caption: "Tasks not assigned to anyone" },
  };
  const copy = COPY[activeTab];

  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>, item: BacklogItemData) {
    if (e.target !== e.currentTarget) return; // a key on the arrow inside the row is the arrow's, not the row's
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My Task"
        description={`${shown.length} ${shown.length === 1 ? "task" : "tasks"} ${copy.noun}. Click one to see its details.`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? "bg-accent font-semibold text-accent-foreground" : "bg-hover text-muted"}`}>{lists[t.id].length}</span>
            </button>
            </DisabledTip>
          );
        })}
      </div>
      <div role="group" aria-label="View" className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {([["list", "List"], ["board", "Board"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${view === id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`}
          >
            {id === "list" ? <ListIcon width={15} height={15} /> : (
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1.2" /><rect x="10" y="4" width="5" height="10" rx="1.2" /><rect x="17" y="4" width="4" height="13" rx="1.2" /></svg>
            )}
            {label}
          </button>
        ))}
      </div>
      </div>
      {shown.length > 0 && view === "board" ? (
        <MyTaskBoard
          items={shown}
          onOpen={(item) => setOpen(item)}
          caption={copy.caption}
          canMove={canMove}
          onMove={async (item, status, reason) => {
            const saved = await leadUpdateItem(item.id, { status, comment: reason });
            if (saved) toast.show(`${item.title} moved to ${statusLabel(status)}`);
            return saved;
          }}
        />
      ) : (
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {shown.length === 0 ? (
          <EmptyState title={copy.title} description={copy.description} />
        ) : (
          <div className="rt-box"><div className="table-scroll" style={{ "--row-h": "3.1rem" } as React.CSSProperties}>
            <table className="rt w-full min-w-[48rem] text-sm">
              <caption className="sr-only">{copy.caption}</caption>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className={head}>Title</th>
                  <th scope="col" className={head}>Type</th>
                  <th scope="col" className={head}>Priority</th>
                  <th scope="col" className={head}>Status</th>
                  <th scope="col" className={head}>Sprint</th>
                  <th scope="col" className={head}>Assignee</th>
                  <th scope="col" className={head}>Expected ETA</th>
                  <th scope="col" className={head}>Developer ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((item) => (
                  <Fragment key={item.id}>
                  <tr
                    data-task={item.id}
                    tabIndex={0}
                    onClick={() => setOpen(item)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    aria-label={`View ${item.title}`}
                    className="cursor-pointer transition-colors duration-150 hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <td data-primary className="max-w-xs px-4 py-2 font-medium">
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => (e.stopPropagation(), showDetails(item, e.currentTarget))}
                          aria-expanded={pop?.item.id === item.id}
                          aria-label={`${pop?.item.id === item.id ? "Hide" : "Show"} details of ${item.title}`}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background/70 text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <ChevronRightIcon width={12} height={12} className={`transition-transform duration-150 ${pop?.item.id === item.id ? "-rotate-90" : ""}`} />
                        </button>
                        <span className="truncate">{item.title}</span>
                      </span>
                    </td>
                    <td data-label="Type" className="whitespace-nowrap px-4 py-2 text-muted"><TypeLabel type={item.type} /></td>
                    <td data-label="Priority" className="px-4 py-2">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td data-label="Status" className="px-4 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td data-label="Sprint" className="whitespace-nowrap px-4 py-2 text-muted">{sprintLabel(item.sprint)}</td>
                    <td data-label="Assignee" className="px-4 py-2">
                      <TaskAssignees passive item={item} size={24} />
                    </td>
                    <td data-label="Expected ETA" className="whitespace-nowrap px-4 py-2 text-muted">
                      {item.deadline ? <time dateTime={item.deadline}>{formatDeadline(item.deadline)}</time> : "–"}
                    </td>
                    <td data-label="Developer ETA" className="whitespace-nowrap px-4 py-2 text-muted">
                      {item.leadDeadline ? <time dateTime={item.leadDeadline}>{formatDeadline(item.leadDeadline)}</time> : "–"}
                    </td>
                  </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
</div>
        )}
      </section>
      )}
      {pop && <TaskPopover key={pop.item.id} item={pop.item} anchor={pop.anchor} onClose={() => setPop(null)} onOpen={() => (setPop(null), setOpen(pop.item))} />}
      {open && <ViewTaskDrawer noExpand key={open.id} item={shared.find((i) => i.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}
