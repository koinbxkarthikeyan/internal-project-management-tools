"use client";

import { useState, type CSSProperties } from "react";
import PageHeader from "@/components/layout/PageHeader";
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
import SprintHeaderTitle from "./SprintHeaderTitle";
import SprintItemsTable from "./SprintItemsTable";

export default function SprintPlanPage() {
  const { items: allItems, updateItem, sprints, deleteSprint, activeSprint, closeSprint, startSprint } = useBacklog();
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [deletingSprint, setDeletingSprint] = useState<Sprint | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [closingSprint, setClosingSprint] = useState<Sprint | null>(null);
  const toast = useToast();
  const [editing, setEditing] = useState<BacklogItemData | null>(null);
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
      <div className="grid gap-4">
        {sprints.map((sp, index) => {
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
                    if (await startSprint(s.name)) toast.show(`${s.name} started`);
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
                <SprintItemsTable items={items} onOpen={setEditing} />
              )}
            </section>
          );
        })}
      </div>
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
