"use client";

import { Fragment, useEffect, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { DisabledTip } from "@/components/ui/DisabledTip";
import { unreadForTask, unreadNoticesForTask } from "@/features/notifications/forTask";
import { useOpenNotification } from "@/features/notifications/open";
import { useNotificationStore } from "@/features/notifications/store";
import TaskCardMore, { RowArrow } from "@/features/backlog/components/TaskCardMore";
import CreateTicketButton from "@/features/backlog/components/CreateTicketButton";
import { PRIORITY_ROW } from "@/features/backlog/priorityCard";
import MyTaskBoard from "./MyTaskBoard";
import EmptyState from "@/components/ui/EmptyState";
import { useQueryState } from "@/hooks/useQueryState";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline } from "@/features/backlog/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyTasksStore } from "@/stores/myTasksStore";
import type { BacklogItemData } from "@/types/backlog";
import { sprintLabel } from "@/constants/backlog-options";
import { MY_TASK_HREF } from "@/constants/work";
import { DEVELOPER_ETA, EXPECTED_ETA } from "@/constants/eta";

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
  const { items: shared, activeSprint } = useBacklog();
  const { user } = useAuth();
  const router = useRouter();
  // A task opens as its own full page (its details, its Tickets as a board, history and comments); Back returns here.
  // A Ticket opens as its own page. `comment` (from a notification) makes the page scroll to that comment.
  const setOpen = (item: BacklogItemData, comment?: string | null) => {
    const to = `${MY_TASK_HREF}/${item.type === "Ticket" ? "ticket" : "task"}?id=${item.apiId}`;
    router.push(comment ? `${to}&comment=${encodeURIComponent(comment)}` : to);
  };
  const pathname = usePathname();
  const toast = useToast();
  const search = useSearchParams();
  const taskParam = search.get("task");
  const commentParam = search.get("comment");
  const [tab, setTab] = useQueryState<Tab>("tab", ["mine", "lead", "unassigned"], "mine");
  const [view, setView] = useQueryState<"list" | "board">("view", ["list", "board"], "board", "myTaskView");

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
  const all = [...mineStore.buckets.lead, ...mineStore.buckets.assigned, ...mineStore.buckets.unassigned, ...mineStore.buckets.tickets];

  // A notification opens its task as `/my-task?task=<code>`: it opens (only if this person can see it) and the code is then taken out of the address.
  const linked = taskParam && mineReady ? (shared.find((t) => t.id === taskParam) ?? all.find((t) => t.id === taskParam) ?? null) : null;
  useEffect(() => {
    if (!taskParam || !mineReady) return;
    // The task opens as its full page (replacing this address, so Back does not come back to the code); a task this person can't see is said so.
    if (linked) setOpen(linked, commentParam);
    else {
      router.replace(pathname, { scroll: false });
      toast.show("That task isn't available to you, or it no longer exists.", "info");
    }
    // Only the address and the load decide when this runs; the code is read once and then removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskParam, mineReady]);

  // A task that was copied into the next sprint when its sprint closed is left out (the copy is the live one).
  const carried = new Set([...shared, ...all].flatMap((t) => (t.carriedFrom ? [t.carriedFrom] : [])));
  // Only the running sprint's tasks: none from planned, paused, closed or earlier sprints, and no Backlog tasks. It follows the sprint now running and each task's current sprint.
  const live = (t: BacklogItemData) => !carried.has(t.id) && !!activeSprint && t.sprint === activeSprint.name;
  // The Tickets assigned to me, by the task they belong to: a task with an open Ticket for me is marked (and listed under My Tasks even when it is not assigned to me).
  const myTickets = mineStore.buckets.tickets;
  const openTicketsFor = (task: BacklogItemData) => myTickets.filter((t) => t.parent === task.id && t.status !== "Done").length;
  // The tasks whose Tickets and comments are open under their row.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const toggleRow = (id: string) => setOpened((o) => { const n = new Set(o); if (!n.delete(id)) n.add(id); return n; });
  const notices = useNotificationStore((s) => s.items);
  const unreadFor = (task: BacklogItemData) => unreadForTask(notices, task);
  const openNotification = useOpenNotification();
  const openLatestNotice = (task: BacklogItemData) => {
    const n = unreadNoticesForTask(notices, task)[0];
    if (n) openNotification(n);
  };
  const withMyTickets = new Set(myTickets.filter((t) => t.parent && t.status !== "Done").map((t) => t.parent));
  const assigned = fresh(mineStore.buckets.assigned);
  const viaTickets = shared.filter((t) => withMyTickets.has(t.id) && !assigned.some((a) => a.id === t.id));
  const lists: Record<Tab, BacklogItemData[]> = {
    mine: [...assigned, ...viaTickets].filter(live),
    lead: fresh(mineStore.buckets.lead).filter(live),
    unassigned: fresh(mineStore.buckets.unassigned).filter(live),
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
  const mine = (item: BacklogItemData) => !!user && (item.assigneeIds ?? []).includes(user.id);

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
        actions={
          <div role="group" aria-label="View" className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
            {(["list", "board"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-8 px-3 capitalize focus-visible:outline-2 focus-visible:outline-accent ${view === v ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover"}`}>
                {v}
              </button>
            ))}
          </div>
        }
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
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? "bg-accent font-semibold text-accent-foreground" : "bg-hover text-muted"}`}>{lists[t.id].length}</span>
            </button>
            </DisabledTip>
          );
        })}
      </div>
      {view === "board" && shown.length > 0 ? (
        <MyTaskBoard tasks={shown} isMine={mine} openTicketsFor={openTicketsFor} unreadFor={unreadFor} onBell={openLatestNotice} onOpen={(t) => (useNotificationStore.getState().markTaskRead(t), setOpen(t))} />
      ) : (
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {shown.length === 0 ? (
          <EmptyState title={copy.title} description={copy.description} />
        ) : (
          <div className="rt-box"><div className="table-scroll" style={{ "--row-h": "3.1rem" } as React.CSSProperties}>
            <table className="rt w-full min-w-[56rem] text-sm">
              <caption className="sr-only">{copy.caption}</caption>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className={head}>ID</th>
                  <th scope="col" className={head}>Title</th>
                  <th scope="col" className={head}>Type</th>
                  <th scope="col" className={head}>Priority</th>
                  <th scope="col" className={head}>Status</th>
                  <th scope="col" className={head}>Sprint</th>
                  <th scope="col" className={head}>Expected ETA</th>
                  <th scope="col" className={head}>Developer ETA</th>
                  <th scope="col" className={head}>Ready for QA Date</th>
                  <th scope="col" className={`${head} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((item) => (
                  <Fragment key={item.id}>
                  <tr
                    tabIndex={0}
                    onClick={() => setOpen(item)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    aria-label={`View ${item.title}${mine(item) ? " (assigned to you)" : ""}`}
                    title={openTicketsFor(item) ? `${openTicketsFor(item)} Ticket${openTicketsFor(item) === 1 ? "" : "s"} assigned to you` : mine(item) ? "Assigned to you" : undefined}
                    className={`cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${unreadFor(item) > 0 ? "row-flash " : ""}${PRIORITY_ROW[item.priority]}`}
                  >
                    <td data-label="ID" className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted">{item.id}</td>
                    <td data-primary className="max-w-xs truncate px-4 py-2 font-medium">{item.title}{openTicketsFor(item) > 0 && <span className="ml-2 rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">{openTicketsFor(item)} {openTicketsFor(item) === 1 ? "Ticket" : "Tickets"} for you</span>}</td>
                    <td data-label="Type" className="whitespace-nowrap px-4 py-2 text-muted">{item.type ?? "–"}</td>
                    <td data-label="Priority" className="px-4 py-2">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td data-label="Status" className="px-4 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td data-label="Sprint" className="whitespace-nowrap px-4 py-2 text-muted">{sprintLabel(item.sprint)}</td>
                    <td data-label={EXPECTED_ETA} className="whitespace-nowrap px-4 py-2 text-muted">
                      {item.deadline ? <time dateTime={item.deadline}>{formatDeadline(item.deadline)}</time> : "–"}
                    </td>
                    <td data-label={DEVELOPER_ETA} className="whitespace-nowrap px-4 py-2 text-muted">
                      {item.status !== "Ready for QA" && item.status !== "Testing" && item.leadDeadline ? <time dateTime={item.leadDeadline}>{formatDeadline(item.leadDeadline)}</time> : "–"}
                    </td>
                    <td data-label="Ready for QA Date" className="whitespace-nowrap px-4 py-2 text-muted">
                      {item.readyForQaDate ? <time dateTime={item.readyForQaDate}>{formatDeadline(item.readyForQaDate)}</time> : "–"}
                    </td>
                    <td data-label="Actions" className="whitespace-nowrap px-4 py-2 text-right"><span className="inline-flex items-center gap-1.5"><CreateTicketButton task={item} /><RowArrow open={opened.has(item.id)} onToggle={() => toggleRow(item.id)} /></span></td>
                  </tr>
                  {opened.has(item.id) && (
                    <tr className={PRIORITY_ROW[item.priority]}><td colSpan={10} className="px-4 pb-3"><TaskCardMore task={item} /></td></tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
</div>
        )}
      </section>
      )}
    </div>
  );
}
