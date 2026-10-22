"use client";

import { DisabledTip } from "@/components/ui/DisabledTip";
import { useRef, useState, type CSSProperties } from "react";
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
import EditBacklogDrawer from "./EditBacklogDrawer";
import { formatDeadline } from "../utils";
import SprintHeaderTitle from "./SprintHeaderTitle";
import SprintItemsTable from "./SprintItemsTable";
import TaskHistoryModal from "@/features/work/components/TaskHistoryModal";

export default function SprintPlanPage() {
  const { items: allItems, hiddenItems, updateItem, sprints, deleteSprint, activeSprint, closeSprint, startSprint } = useBacklog();
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [deletingSprint, setDeletingSprint] = useState<Sprint | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [closingSprint, setClosingSprint] = useState<Sprint | null>(null);
  const toast = useToast();
  const starting = useRef(false); // a double click on Start sprint must not send it twice
  const [viewing, setViewing] = useState<BacklogItemData | null>(null);
  const [tab, setTab] = useQueryState<"active" | "unplanned-closed" | "closed">("sprints", ["active", "unplanned-closed", "closed"], "active");
  // The one closed sprint that is expanded, by sprint id (opening another closes it; clicking it again collapses it).
  // `undefined` means nothing has been chosen yet: the most recently closed sprint is open until the person picks.
  const [openClosed, setOpenClosed] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState<BacklogItemData | null>(null);
  const renderSprint = (sp: Sprint, index: number, pick: (i: BacklogItemData) => boolean = () => true) => {
    const sprint = sp.name;
    const items = allItems.filter((i) => i.sprint === sprint && pick(i));
    return (
      <section
        key={sprint}
        style={{ "--i": index } as CSSProperties}
        className="anim-fade-up overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
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
                if (await startSprint(s.name)) toast.show(`${s.name} started`);
              } finally {
                starting.current = false;
              }
            }}
          />
          <span className="rounded-full bg-hover px-2 py-0.5 text-xs tabular-nums text-muted">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        {/* PODs are hidden here (nothing is removed): tasks are listed straight from the sprint they were created in. */}
        {items.length === 0 ? (
          <EmptyState compact title="No items planned" description="Assign items to this sprint from the Edit backlog panel." />
        ) : (
          <SprintItemsTable items={items} onOpen={sp.status === "Closed" ? setViewing : setEditing} onView={setViewing} readOnly={sp.status === "Closed"} />
        )}
      </section>
    );
  };

  // Running (and waiting) sprints first, Unplanned next, finished sprints last with the newest closed one on top.
  const running = sprints.filter((s) => s.name !== "Unplanned" && s.status !== "Closed");
  // Unplanned tasks: the open ones sit under the running sprint on Active Sprint, the completed ones have their own tab
  // (the Unplanned sprint record, or a stand-in while the backend sends none).
  // Completed unplanned tasks are listed apart from the ones still open.
  const unplannedAll = allItems.filter((i) => i.sprint === "Unplanned");
  const unplannedClosedCount = unplannedAll.filter((i) => i.status === "Completed").length;
  const unplannedCount = unplannedAll.length - unplannedClosedCount;
  const unplannedSprint: Sprint = sprints.find((s) => s.name === "Unplanned") ?? { id: "unplanned", name: "Unplanned" };
  const closed = sprints
    .filter((s) => s.name !== "Unplanned" && s.status === "Closed")
    .sort((x, y) => (y.closedAt ?? y.end ?? "").localeCompare(x.closedAt ?? x.end ?? "") || (y.start ?? "").localeCompare(x.start ?? ""));
  // A tab that is empty is disabled, so a saved link to it falls back to Active Sprint.
  const activeTab = (tab === "closed" && closed.length === 0) || (tab === "unplanned-closed" && unplannedClosedCount === 0) ? "active" : tab;

  const expandedClosedId = openClosed === undefined ? (closed[0]?.id ?? null) : openClosed;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sprint plan"
        description={
          activeSprint
            ? `${activeSprint.name} is running. It closes on its end date, or earlier when you close it; the next sprint then waits as Paused until you start it.`
            : "Items planned for each sprint, in one place."
        }
        actions={
<DisabledTip reason={!!activeSprint && `${activeSprint.name} is still running. Close it first; the next sprint then waits as Paused until you start it.`} className="inline-block">
                    <button
            type="button"
            onClick={() => setCreatingSprint(true)}
            disabled={!!activeSprint}
            className="flex items-center gap-2 rounded-xl btn-brand px-4 py-2.5 text-sm font-medium font-semibold disabled:cursor-not-allowed  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PlusIcon />
            New sprint
          </button>
          </DisabledTip>
        }
      />
      <div role="tablist" aria-label="Sprints" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            { id: "active", label: "Active Sprint", count: running.length },
            { id: "closed", label: "Closed Sprints", count: closed.length },
            { id: "unplanned-closed", label: "Closed Unplanned Tasks", count: unplannedClosedCount },
          ] as const
        ).map((t) => {
          const disabled = t.count === 0 && t.id !== "active";
          const on = activeTab === t.id;
          return (
            <DisabledTip key={t.id} reason={disabled && (t.id === "closed" ? "No sprint has been closed yet." : "There are no closed unplanned tasks.")} className="inline-block">
            <button
              type="button"
              role="tab"
              aria-selected={on}
              disabled={disabled}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                on ? "bg-accent-soft font-medium text-accent" : disabled ? "cursor-not-allowed text-muted opacity-50" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-[#425df3] font-semibold text-white dark:bg-accent dark:text-accent-foreground" : "bg-hover text-muted"}`}>{t.count}</span>
            </button>
            </DisabledTip>
          );
        })}
      </div>

      {activeTab === "unplanned-closed" ? (
        <section aria-label="Closed unplanned tasks" className="grid gap-4">
          {renderSprint(unplannedSprint, 0, (i) => i.status === "Completed")}
        </section>
      ) : activeTab === "active" ? (
        <section aria-label="Active sprint" className="flex flex-col gap-4">
          {running.length === 0 ? (
            sprints.some((s) => s.name !== "Unplanned") ? (
              <p className="rounded-2xl border border-dashed border-border px-5 py-4 text-sm text-muted">No sprint is running right now.</p>
            ) : (
              <EmptyState compact title="No sprint added yet" description="Create a sprint to get started." action={<button type="button" onClick={() => setCreatingSprint(true)} className="btn-brand rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">New sprint</button>} />
            )
          ) : (
            <div className="grid gap-4">{running.map((sp, i) => renderSprint(sp, i))}</div>
          )}
          {unplannedCount > 0 && <div className="grid gap-4">{renderSprint(unplannedSprint, running.length, (i) => i.status !== "Completed")}</div>}
        </section>
      ) : (
        /* Closed sprints: one compact row each (name, dates, task count); a row opens its tasks, view only. Only one is open at a time. */
        <section aria-label="Closed sprints" className="-mt-2">
          {closed.length === 0 ? (
            <p className="px-1 text-xs text-muted">No closed sprints yet</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {closed.map((sp) => {
                const items = allItems.filter((i) => i.sprint === sp.name);
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
                        className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
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
                      <div className="border-t border-border">
                        {items.length === 0 ? (
                          <p className="px-4 py-2 text-xs text-muted">No tasks in this sprint.</p>
                        ) : (
                          <SprintItemsTable items={items} onOpen={setViewing} onView={setViewing} readOnly />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {creatingSprint && <CreateSprintDrawer onClose={() => setCreatingSprint(false)} />}
      {closingSprint && (
        <CloseSprintDrawer
          key={closingSprint.id}
          sprint={closingSprint}
          onClose={() => setClosingSprint(null)}
          onConfirm={async () => {
            if (!(await closeSprint(closingSprint.name))) return false;
            toast.show(`${closingSprint.name} closed. Unfinished tasks were copied to the next sprint.`);
          }}
        />
      )}
      {deletingSprint && (
        <ConfirmDeleteDrawer
          key={deletingSprint.id}
          title="Delete sprint"
          name={deletingSprint.name}
          consequence="Its items will be moved to Unplanned, and the hours logged against it will be removed."
          onClose={() => setDeletingSprint(null)}
          onConfirm={async () => {
            const target = deletingSprint;
            const moved = await deleteSprint(target.name);
            if (moved === null) return false;
            toast.show(
              moved > 0
                ? `${target.name} deleted; ${moved} ${moved === 1 ? "item" : "items"} moved to Unplanned`
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
