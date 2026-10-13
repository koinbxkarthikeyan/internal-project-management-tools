"use client";

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
  const [tab, setTab] = useQueryState<"active" | "closed">("sprints", ["active", "closed"], "active");
  // The one closed sprint that is expanded (opening another closes it; clicking it again collapses it).
  const [openClosed, setOpenClosed] = useState<string | null>(null);
  const [editing, setEditing] = useState<BacklogItemData | null>(null);
  const renderSprint = (sp: Sprint, index: number) => {
    const sprint = sp.name;
    const items = allItems.filter((i) => i.sprint === sprint);
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
  // The Unplanned card is shown only when it has tasks.
  const unplanned = sprints.filter((s) => s.name === "Unplanned" && allItems.some((i) => i.sprint === "Unplanned"));
  const closed = sprints
    .filter((s) => s.name !== "Unplanned" && s.status === "Closed")
    .sort((x, y) => (y.closedAt ?? y.end ?? "").localeCompare(x.closedAt ?? x.end ?? "") || (y.start ?? "").localeCompare(x.start ?? ""));

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
          <button
            type="button"
            onClick={() => setCreatingSprint(true)}
            disabled={!!activeSprint}
            title={activeSprint ? `${activeSprint.name} is still running. Closing it leaves the next sprint Paused until you start it.` : undefined}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PlusIcon />
            New sprint
          </button>
        }
      />
      <div role="tablist" aria-label="Sprints" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            { id: "active", label: "Active Sprint", count: running.length },
            { id: "closed", label: "Closed Sprints", count: closed.length },
          ] as const
        ).map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-accent text-accent-foreground" : "bg-hover text-muted"}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === "active" ? (
        <section aria-label="Active sprint" className="flex flex-col gap-4">
          {running.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-5 py-4 text-sm text-muted">No sprint is running right now.</p>
          ) : (
            <div className="grid gap-4">{running.map((sp, i) => renderSprint(sp, i))}</div>
          )}
          {unplanned.length > 0 && <div className="grid gap-4">{unplanned.map((sp, i) => renderSprint(sp, running.length + i))}</div>}
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
                const open = openClosed === sp.name;
                const toggle = () => setOpenClosed((prev) => (prev === sp.name ? null : sp.name));
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
            toast.show(`${saved.id} updated`);
          }}
        />
      )}
    </div>
  );
}
