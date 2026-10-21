"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  PRIORITIES,
  STATUS_OPTIONS,
} from "@/constants/backlog-options";
import { useBacklog } from "../context/BacklogContext";
import type { BacklogItemData } from "@/types/backlog";
import type { BacklogItemActions } from "./BacklogItem";
import BacklogFilters, { EMPTY_FILTERS, type FilterState } from "./BacklogFilters";
import BacklogHeader from "./BacklogHeader";
import BacklogList from "./BacklogList";
import BacklogSummary from "./BacklogSummary";
import BacklogViewTabs, { type BacklogView } from "./BacklogViewTabs";
import ConfirmDeleteDrawer from "./ConfirmDeleteDrawer";
import EditBacklogDrawer from "./EditBacklogDrawer";

const STATIC_FILTER_OPTIONS = {
  status: STATUS_OPTIONS,
  priority: PRIORITIES,
};

export default function BacklogPage() {
  const { owners, sprintNames, items, hiddenItems, updateItem, deleteItem, hideItem, restoreItem } = useBacklog();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<BacklogItemData | null>(null);
  const [deleting, setDeleting] = useState<BacklogItemData | null>(null);
  const [selectedView, setView] = useState<BacklogView>("visible");

  const toast = useToast();
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());

  // Play the row exit animation first, then apply the change.
  function exitThen(id: string, apply: () => Promise<void>) {
    setLeaving((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      await apply();
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 220);
  }

  const actions: BacklogItemActions = {
    onEdit: setEditing,
    onToggleHidden: (item) =>
      exitThen(item.id, async () => {
        if (item.hidden) {
          if (await restoreItem(item.id)) toast.show(`${item.title} restored to All items`);
        } else if (await hideItem(item.id)) {
          toast.show(`${item.title} hidden`, "info");
        }
      }),
    onDelete: setDeleting,
  };

  const counts = { visible: items.length, hidden: hiddenItems.length };
  // Fall back to the main list when the Hidden list becomes empty (e.g. last item restored).
  const view: BacklogView = counts.hidden === 0 ? "visible" : selectedView;
  const inView = view === "hidden" ? hiddenItems : items;

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return inView.filter(
      (i) =>
        (!q || i.title.toLowerCase().includes(q) || i.owner.toLowerCase().includes(q)) &&
        (!filters.status || i.status === filters.status) &&
        (!filters.priority || i.priority === filters.priority) &&
        (!filters.owner || i.owner === filters.owner) &&
        (!filters.sprint || i.sprint === filters.sprint) &&
        (!filters.deadlineFrom || (!!i.deadline && i.deadline >= filters.deadlineFrom)) &&
        (!filters.deadlineTo || (!!i.deadline && i.deadline <= filters.deadlineTo)),
    );
  }, [inView, filters]);

  return (
    <div className="flex flex-col gap-6">
      <BacklogHeader />
      <BacklogSummary items={items} />
      <BacklogFilters filters={filters} onChange={setFilters} options={{ ...STATIC_FILTER_OPTIONS, owner: owners, sprint: sprintNames }} />
      <div>
        <BacklogViewTabs view={view} onChange={setView} counts={counts} />
      </div>
      <BacklogList
        items={visible}
        total={inView.length}
        actions={actions}
        leavingIds={leaving}
        emptyTitle={view === "hidden" ? "No hidden items" : "No backlog items yet"}
        emptyMessage={
          view === "hidden"
            ? "Use the row menu to hide an item and it will show up here."
            : "Use Create backlog to add your first item."
        }
      />
      {deleting && (
        <ConfirmDeleteDrawer
          key={deleting.id}
          title="Delete backlog item"
          name={deleting.title}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            const target = deleting;
            // Play the row's exit animation, then delete it.
            exitThen(target.id, async () => {
              if (await deleteItem(target.id)) toast.show(`${target.title} deleted`, "delete");
            });
          }}
        />
      )}
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
