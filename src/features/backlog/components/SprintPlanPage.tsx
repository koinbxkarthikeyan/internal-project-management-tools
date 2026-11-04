"use client";

import { DisabledTip } from "@/components/ui/DisabledTip";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useQueryState } from "@/hooks/useQueryState";
import { useToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";
import { PlusIcon } from "@/components/ui/icons";
import CloseSprintDrawer from "./CloseSprintDrawer";
import CreateSprintDrawer from "./CreateSprintDrawer";
import ConfirmDeleteDrawer from "./ConfirmDeleteDrawer";
import EditSprintDrawer from "./EditSprintDrawer";
import { useBacklog } from "../context/BacklogContext";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import { sprintLabel } from "@/constants/backlog-options";
import { carryOverSource } from "../carryOver";
import EditBacklogDrawer from "./EditBacklogDrawer";
import { useHoverTip } from "@/components/ui/HoverTip";
import { formatDeadline, todayISO } from "../utils";
import { eachDay, plannedHours, workingDays } from "@/features/work/utils";
import SprintHeaderTitle from "./SprintHeaderTitle";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTaskOrderStore } from "@/stores/taskOrderStore";
import { useSprintMoves } from "../hooks/useSprintMoves";
import { applyOrder, dropIds, stepIds } from "../taskOrder";
import SprintItemsTable from "./SprintItemsTable";
import TaskHistoryModal from "@/features/work/components/TaskHistoryModal";

const PARKED = "pointer-events-none absolute -left-[99999px] top-0 w-full opacity-0";

export default function SprintPlanPage() {
  const { status, items: allItems, hiddenItems, updateItem, sprints, deleteSprint, updateSprint, activeSprint, closeSprint, startSprint } = useBacklog();
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [deletingSprint, setDeletingSprint] = useState<Sprint | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [closingSprint, setClosingSprint] = useState<Sprint | null>(null);
  const toast = useToast();
  const starting = useRef(false); // a double click on Start sprint must not send it twice
  const [viewing, setViewing] = useState<BacklogItemData | null>(null);
  const [tab, setTab] = useQueryState<"active" | "unplanned-closed" | "closed" | "plan">("sprints", ["active", "unplanned-closed", "closed", "plan"], "active");
  // The one closed sprint that is expanded, by sprint id (opening another closes it; clicking it again collapses it).
  // `undefined` means nothing has been chosen yet: the most recently closed sprint is open until the person picks.
  const [openClosed, setOpenClosed] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState<BacklogItemData | null>(null);
  // Moving tasks between sections (arrows and drag-and-drop share useSprintMoves).
  const moves = useSprintMoves();
  const dropTip = useHoverTip(150);
  const hideDropTip = dropTip.hide;
  const [dragging, setDragging] = useState<BacklogItemData | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // The order of tasks inside each list is a view setting kept in this browser (see taskOrderStore); it never changes which sprint a task is in.
  const { user } = useAuth();
  const orders = useTaskOrderStore((st) => st.orders[user?.id ?? ""]) ?? {};
  const setOrder = useTaskOrderStore((st) => st.setOrder);
  // Holding a dragged task over a tab opens it after 500ms; leaving the tab (or any drop or drag end) cancels that.
  const tabTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const disarmTab = () => clearTimeout(tabTimer.current);
  const armTab = (id: "active" | "plan") => {
    clearTimeout(tabTimer.current);
    tabTimer.current = setTimeout(() => setTab(id), 500);
  };
  // The dragged row can disappear when the tab changes, and then its own "drag ended" never arrives: any drop or end anywhere clears the drag.
  useEffect(() => {
    const clear = () => (clearTimeout(tabTimer.current), hideDropTip(), setDragging(null), setOver(null));
    document.addEventListener("dragend", clear);
    document.addEventListener("drop", clear);
    return () => {
      document.removeEventListener("dragend", clear);
      document.removeEventListener("drop", clear);
      clearTimeout(tabTimer.current);
    };
  }, [hideDropTip]);
  // Tasks the backend carried from one sprint to the next: the old record stays in its sprint as history and the new one names it (by code), so each side can point to the other.
  const carryNote = (item: BacklogItemData) => {
    // The task's own sprint history (ids, in order; null is Backlog) decides first; the code link below is for tasks the backend sent without history.
    const from = carryOverSource(item, sprints);
    if (from) return `Carried from ${from}`;
    const everyTask = [...allItems, ...hiddenItems];
    const to = everyTask.find((t) => t.carriedFrom === item.id);
    if (to) return `Carried forward to ${sprintLabel(to.sprint)}`;
    if (item.carriedFrom) return `Carried from ${sprintLabel(everyTask.find((t) => t.id === item.carriedFrom)?.sprint ?? "an earlier sprint")}`;
  };
  const saveOrder = (list: string, ids: string[]) => user && setOrder(user.id, list, ids);
  // A sprint's title with its actions (Start, Close, Edit, Delete), the same wherever a sprint is listed.
  // A planned sprint can start on any day: its start date is moved to today first when it differs (the backend then works out the end date), then it is started.
  // Each step reports its own failure; nothing is shown as started unless the server did it.
  const startToday = async (sp: Sprint) => {
    const today = todayISO();
    if (sp.start !== today && (await updateSprint(sp.name, { name: sp.name, start: today })) !== "ok") {
      toast.show(`${sp.name} was not started: its start date couldn't be moved to today.`, "danger");
      return false;
    }
    return startSprint(sp.name);
  };
  const sprintHeader = (sp: Sprint) => (
    <SprintHeaderTitle
            sprint={sp}
            onEdit={setEditingSprint}
            onDelete={setDeletingSprint}
            onClose={setClosingSprint}
            canStart={!activeSprint}
            onStart={async (s) => {
              if (starting.current) return;
              starting.current = true;
              try {
                if (await startToday(s)) toast.show(`${s.name} started`);
              } finally {
                starting.current = false;
              }
            }}
    />
  );
  const renderSprint = (sp: Sprint, index: number, pick: (i: BacklogItemData) => boolean = () => true) => {
    const sprint = sp.name;
    const items = applyOrder(allItems.filter((i) => i.sprint === sprint && pick(i)), orders[sprint]);
    return (
      <section
        key={sprint}
        style={{ "--i": index } as CSSProperties}
        // A section that can take the dragged task is outlined; the one under the pointer is outlined harder. A closed sprint is never one of them.
        onDragOver={(e) => {
          if (dragging && moves.canDrop(dragging, sprint)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (over !== sprint) dropTip.show("Drop here to move this task into this sprint.", e);
            setOver(sprint);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          dropTip.hide();
          setOver((o) => (o === sprint ? null : o));
        }}
        onDrop={(e) => {
          e.preventDefault();
          dropTip.hide();
          const task = dragging;
          setDragging(null);
          setOver(null);
          if (task && moves.canDrop(task, sprint)) void moves.move(task, sprint); // moved at once; a move the server refuses is reported and the task stays where it was
        }}
        className={`anim-fade-up overflow-hidden rounded-2xl border bg-surface transition-shadow ${
          dragging && moves.canDrop(dragging, sprint) ? (over === sprint ? "border-accent ring-2 ring-accent" : "border-accent/60 ring-1 ring-accent/40") : "border-border"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          {sprintHeader(sp)}
          <span className="rounded-full bg-hover px-2 py-0.5 text-xs tabular-nums text-muted">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        {/* PODs are hidden here (nothing is removed): tasks are listed straight from the sprint they were created in. */}
        {items.length === 0 ? (
          <EmptyState compact title="No items planned" description={sprint === "Unplanned" ? "Tasks in no sprint are listed here. Drag a task here." : "Drag a task here, or assign items from the Edit backlog panel."} />
        ) : (
          <SprintItemsTable
            items={items}
            onOpen={sp.status === "Closed" ? setViewing : setEditing}
            onView={setViewing}
            onStep={sp.status === "Closed" ? undefined : (task, dir) => saveOrder(sprint, stepIds(items.map((i) => i.id), task.id, dir))}
            onDropRow={sp.status === "Closed" ? undefined : (id, target, after) => saveOrder(sprint, dropIds(items.map((i) => i.id), id, target, after))}
            onDragItem={setDragging}
            draggingId={dragging?.id}
            readOnly={sp.status === "Closed"}
            carryNote={carryNote}
          />
        )}
      </section>
    );
  };

  // Running (and waiting) sprints first, Unplanned next, finished sprints last with the newest closed one on top.
  const running = sprints.filter((s) => s.name !== "Unplanned" && s.status !== "Closed");
  // Unplanned tasks: the open ones sit under the running sprint on Active Sprint, the completed ones have their own tab
  // (the Unplanned sprint record, or a stand-in while the backend sends none).
  // Completed unplanned tasks are listed apart from the ones still open.
  // The running sprint, and the sprints planned to follow it (waiting to start).
  const current = running.filter((s) => s.status === "Active");
  const planned = running.filter((s) => s.status !== "Active");
  const unplannedAll = allItems.filter((i) => i.sprint === "Unplanned");
  const unplannedClosedCount = unplannedAll.filter((i) => i.status === "Completed").length;
  const unplannedSprint: Sprint = sprints.find((s) => s.name === "Unplanned") ?? { id: "unplanned", name: "Unplanned" };
  const closed = sprints
    .filter((s) => s.name !== "Unplanned" && s.status === "Closed")
    .sort((x, y) => (y.closedAt ?? y.end ?? "").localeCompare(x.closedAt ?? x.end ?? "") || (y.start ?? "").localeCompare(x.start ?? ""));
  // A tab that is empty is disabled, so a saved link to it falls back to Active Sprint.
  // The old Closed Sprints and Closed Backlog Tasks tabs are now one: "Close Sprint". A saved link to either opens it.
  // The running sprint's tasks for the Close Sprint tab: still open, and finished.
  const cur = current[0];
  const curItems = cur ? allItems.filter((i) => i.sprint === cur.name) : [];
  const remaining = curItems.filter((i) => i.status !== "Completed");
  const finished = curItems.filter((i) => i.status === "Completed");

  // Close Sprint is available only while there is a running sprint with tasks still open (the work to review before closing). Until the data has loaded
  // it is not available either: missing data is never read as "nothing to close". It is worked out from the current sprint and task data on every render.
  const closeAvailable = status === "ready";
  const requested = tab === "unplanned-closed" ? "closed" : tab;
  const activeTab = requested === "closed" && !closeAvailable ? "active" : requested; // a saved link to a disabled tab opens Active Sprint

  const expandedClosedId = openClosed === undefined ? (closed[0]?.id ?? null) : openClosed;

  return (
    <div className="flex flex-col gap-6">
      {dropTip.bubble}
      <PageHeader
        title="Sprint plan"
        description={
          activeSprint
            ? `${activeSprint.name} is running. It closes on its end date, or earlier when you close it; the next sprint then waits as Planned until you start it.`
            : "Items planned for each sprint, in one place."
        }
        actions={
<button
            type="button"
            onClick={() => setCreatingSprint(true)}
            className="flex items-center gap-2 rounded-xl btn-brand px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PlusIcon />
            Plan New Sprint
          </button>
        }
      />
      <div role="tablist" aria-label="Sprints" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            { id: "active", label: "Active Sprint", count: current.length },
            { id: "plan", label: "Plan Sprint", count: planned.length },
            { id: "closed", label: "Close Sprint", count: closed.length },
          ] as const
        ).map((t) => {
          const disabled = t.id === "closed" && !closeAvailable;
          const on = activeTab === t.id;
          return (
            <DisabledTip key={t.id} reason={disabled && "Loading sprint data…"} className="inline-block">
            <button
              type="button"
              role="tab"
              aria-selected={on}
              disabled={disabled}
              onClick={() => setTab(t.id)}
              // While a task is being dragged, holding it over the Active Sprint or Plan Sprint tab opens that tab (after a short pause), so it can be dropped there.
              onDragEnter={() => dragging && (t.id === "active" || t.id === "plan") && !on && armTab(t.id)}
              onDragOver={(e) => dragging && (t.id === "active" || t.id === "plan") && e.preventDefault()}
              onDragLeave={disarmTab}
              onDrop={disarmTab}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                dragging && (t.id === "active" || t.id === "plan") && !on ? "outline-dashed outline-2 outline-accent/60 " : ""
              }${
                on ? "bg-accent-soft font-medium text-accent" : disabled ? "cursor-not-allowed text-muted opacity-50" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-accent font-semibold text-accent-foreground" : "bg-hover text-muted"}`}>{t.count}</span>
            </button>
            </DisabledTip>
          );
        })}
      </div>

      {/* The Active Sprint and Plan Sprint tabs stay mounted when the other is open, parked off-screen (not removed, not display:none, and inert only while nothing is being dragged), because a browser
          ends a drag when its source is removed or hidden: a task dragged from one tab can then be dropped in the other. */}
      <div className={activeTab === "plan" ? undefined : PARKED} inert={activeTab !== "plan" && !dragging} aria-hidden={activeTab !== "plan"}>
        <section aria-label="Plan Sprint" className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            Plan the next sprint here while the current one runs. Planning only creates it; it starts when you press Start sprint and the running sprint closes when you press Close sprint, as separate actions. Dates can&apos;t overlap another sprint.
          </p>
          {[
            { key: "active", title: "Active Sprints", list: current, empty: "No sprint is running." },
            { key: "planned", title: "Planned Sprints", list: planned, empty: "No sprint is planned yet. Use Plan New Sprint." },
          ].map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {group.title} <span className="ml-1 tabular-nums">{group.list.length}</span>
              </h2>
              {group.list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-5 py-3 text-sm text-muted">{group.empty}</p>
              ) : (
                <div className={group.key === "active" || group.key === "planned" ? "grid gap-4" : "grid gap-2"}>
                  {group.list.map((sp, i) => {
                    // Running and planned sprints are full cards here too (their tasks, reordering, and drops from the other tab); finished ones stay a single row.
                    if (group.key === "active" || group.key === "planned") return renderSprint(sp, i);
                    const count = allItems.filter((it) => it.sprint === sp.name).length;
                    return (
                      <div
                        key={sp.id}
                        style={{ "--i": i } as CSSProperties}
                        // A closed sprint never takes a task: a dragged task is accepted over it only so the drop can be answered with a short message (nothing is moved or saved).
                        onDragOver={(e) => dragging && (e.preventDefault(), setOver(sp.name))}
                        onDragLeave={() => setOver((o) => (o === sp.name ? null : o))}
                        onDrop={(e) => {
                          e.preventDefault();
                          const task = dragging;
                          setDragging(null);
                          setOver(null);
                          if (task) void moves.move(task, sp.name);
                        }}
                        className={`anim-fade-up flex items-center justify-between gap-3 rounded-xl border bg-surface px-5 py-3 transition-shadow ${dragging ? (over === sp.name ? "border-danger ring-2 ring-danger/50" : "border-danger/40") : "border-border"}`}
                      >
                        {sprintHeader(sp)}
                        <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-xs tabular-nums text-muted">
                          {count} {count === 1 ? "item" : "items"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Backlog (not completed)</h2>
            <div className="grid gap-4">{renderSprint(unplannedSprint, current.length + planned.length, (i) => i.status !== "Completed")}</div>
          </div>
        </section>
      </div>
      <div className={activeTab === "active" ? undefined : PARKED} inert={activeTab !== "active" && !dragging} aria-hidden={activeTab !== "active"}>
        <section aria-label="Active sprint" className="flex flex-col gap-4">
          <p className="-mt-1 text-xs text-muted">
            Reorder tasks inside a list by dragging a row by its grip (or Alt + Up / Down on a row); the order is kept in this browser only. Dragging a task onto another sprint or the Backlog moves it straight away.
          </p>
          {running.length === 0 ? (
            sprints.some((s) => s.name !== "Unplanned") ? (
              <p className="rounded-2xl border border-dashed border-border px-5 py-4 text-sm text-muted">No sprint is running right now.</p>
            ) : (
              <EmptyState compact title="No sprint added yet" description="Create a sprint to get started." action={<button type="button" onClick={() => setCreatingSprint(true)} className="btn-brand rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">New sprint</button>} />
            )
          ) : (
            <>
              {current.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Current Sprint</h2>
                  <div className="grid gap-4">{current.map((sp, i) => renderSprint(sp, i))}</div>
                </div>
              )}
            </>
          )}
          <div className="grid gap-4">{renderSprint(unplannedSprint, running.length, (i) => i.status !== "Completed")}</div>
        </section>
      </div>
      {activeTab === "closed" && (
        <section aria-label="Close Sprint" className="flex flex-col gap-6">
          {/* The sprint to close: its details and a count of its tasks (the task lists are not repeated here). Closing itself is the sprint's Close sprint action. */}
          {/* The running sprint is shown here only once at least one of its tasks is completed. */}
          {cur && finished.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Current Sprint</h2>
            {(
              <section className="anim-fade-up overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                  {sprintHeader(cur)}
                  <span className="rounded-full bg-hover px-2 py-0.5 text-xs tabular-nums text-muted">
                    {remaining.length} to finish · {finished.length} done
                  </span>
                </div>
                {cur.goal && <p className="border-b border-border px-5 py-2 text-sm text-muted">Goal: {cur.goal}</p>}
                {cur.start && cur.end && (
                  <dl className="grid grid-cols-2 gap-3 border-b border-border px-5 py-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted">Planned duration</dt>
                      <dd>{eachDay(cur.start, cur.end).length} days · {workingDays(cur.start, cur.end)} working days · {plannedHours(cur.start, cur.end)}h</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Running so far</dt>
                      <dd>{cur.start > todayISO() ? "Not started yet" : `${eachDay(cur.start, todayISO() < cur.end ? todayISO() : cur.end).length} days (until today)`}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Final duration</dt>
                      <dd className="text-muted">Set when the sprint is closed</dd>
                    </div>
                  </dl>
                )}
                <div className="flex flex-col gap-1 border-b border-border px-5 pb-1 pt-3">
                  <h3 className="text-sm font-semibold">Completed tasks <span className="font-normal text-muted">({finished.length})</span></h3>
                </div>
                <SprintItemsTable items={finished} onOpen={setViewing} onView={setViewing} readOnly carryNote={carryNote} />
                <p className="px-5 py-3 text-sm text-muted">
                  Closing ends this sprint today. Its finished tasks and logged hours stay in it as history. {remaining.length} unfinished {remaining.length === 1 ? "task is" : "tasks are"} handed on by the server when you close it; none is marked Completed.
                </p>
              </section>
            )}
          </div>
          )}

          {unplannedClosedCount > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Closed Backlog Tasks</h2>
              <div className="grid gap-4">{renderSprint(unplannedSprint, 0, (i) => i.status === "Completed")}</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Closed Sprints</h2>
        {/* Closed sprints: one compact row each (name, dates, task count); a row opens its tasks, view only. Only one is open at a time. */}
        <section aria-label="Closed sprints">
          {closed.length === 0 ? (
            <p className="px-1 text-xs text-muted">No closed sprints yet</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {closed.map((sp) => {
                // The tasks that are in this sprint, and (read-only) the ones the backend says were in it before they moved on: the same task, same ID and code.
                const items = [...allItems.filter((i) => i.sprint === sp.name), ...allItems.filter((i) => i.sprint !== sp.name && i.historySprintIds?.includes(sp.id))];
                const open = expandedClosedId === sp.id;
                const toggle = () => setOpenClosed(open ? null : sp.id);
                return (
                  <li key={sp.id}>
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent ${open ? "bg-hover" : ""}`}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={`shrink-0 text-muted transition-transform duration-[220ms] ease-in-out ${open ? "rotate-90" : ""}`}
                      >
                        <path d="m8 5 5 5-5 5" />
                      </svg>
                      <span className="font-medium">{sp.name}</span>
                      <span className="ml-auto flex items-center gap-3 text-xs text-muted">
                        {sp.start && sp.end && (
                          <span>
                            {formatDeadline(sp.start)} – {formatDeadline(sp.end)}
                          </span>
                        )}
                        <span className="tabular-nums">
                          {items.length} {items.length === 1 ? "task" : "tasks"}
                        </span>
                      </span>
                    </button>
                    {open && (
                      <div className="anim-expand border-t border-border">
                        {items.length === 0 ? (
                          <p className="px-4 py-2 text-xs text-muted">No tasks in this sprint.</p>
                        ) : (
                          <SprintItemsTable items={items} onOpen={setViewing} onView={setViewing} readOnly carryNote={(t) => (t.sprint !== sp.name ? `Carried forward · now in ${sprintLabel(t.sprint)}` : carryNote(t))} />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
          </div>
        </section>
      )}
      {creatingSprint && <CreateSprintDrawer onClose={() => setCreatingSprint(false)} />}
      {closingSprint && (
        <CloseSprintDrawer
          key={closingSprint.id}
          sprint={closingSprint}
          onClose={() => setClosingSprint(null)}
          planned={planned}
          onConfirm={async (startNext) => {
            if (!(await closeSprint(closingSprint.name))) return false;
            toast.show(`${closingSprint.name} closed. Unfinished tasks were copied to the next sprint.`);
            if (!startNext) return;
            // The close has happened; the next sprint then starts today.
            if (await startToday(startNext)) toast.show(`${startNext.name} started`);
          }}
        />
      )}
      {deletingSprint && (
        <ConfirmDeleteDrawer
          key={deletingSprint.id}
          title="Delete sprint"
          name={deletingSprint.name}
          consequence="Its tasks move to Backlog, and the hours logged against it are removed."
          onClose={() => setDeletingSprint(null)}
          onConfirm={async () => {
            const target = deletingSprint;
            const moved = await deleteSprint(target.name);
            if (moved === null) return false;
            toast.show(
              moved > 0
                ? `${target.name} deleted; ${moved} ${moved === 1 ? "item" : "items"} moved to the Backlog`
                : `${target.name} deleted`,
              "danger",
            );
          }}
        />
      )}
      {editingSprint && (
        <EditSprintDrawer key={editingSprint.name} sprint={editingSprint} onClose={() => setEditingSprint(null)} />
      )}
      {viewing && <TaskHistoryModal key={viewing.id} item={viewing} allTasks={[...allItems, ...hiddenItems]} allSprints={sprints} onClose={() => setViewing(null)} />}
      {editing && (
        <EditBacklogDrawer
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (saved) => {
            if (!(await updateItem(saved.id, saved))) return false;
            toast.show(`${saved.title} updated`);
          }}
        />
      )}
    </div>
  );
}
