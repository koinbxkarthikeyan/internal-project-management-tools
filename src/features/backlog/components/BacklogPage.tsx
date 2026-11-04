"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  PRIORITIES,
  STATUS_OPTIONS,
  sprintLabel,
} from "@/constants/backlog-options";
import { useBacklog } from "../context/BacklogContext";
import type { BacklogItemData } from "@/types/backlog";
import type { BacklogItemActions } from "./BacklogItem";
import BacklogFilters, { EMPTY_FILTERS, type FilterState } from "./BacklogFilters";
import BacklogHeader from "./BacklogHeader";
import BacklogList from "./BacklogList";
import StatusCards from "./StatusCards";
import BacklogViewTabs, { type BacklogView } from "./BacklogViewTabs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import * as backlogService from "@/services/backlogService";
import ConfirmDeleteDrawer from "./ConfirmDeleteDrawer";
import RemoveHiddenDialog from "./RemoveHiddenDialog";
import EditBacklogDrawer from "./EditBacklogDrawer";

const STATIC_FILTER_OPTIONS = {
  status: STATUS_OPTIONS,
  priority: PRIORITIES,
};

export default function BacklogPage() {
  const { owners, sprintNames, items, hiddenItems, itemsPaging, updateItem, deleteItem, hideItem, restoreItem, refreshItems } = useBacklog();
  const { isAdmin } = useAuth();
  const [removingHidden, setRemovingHidden] = useState(false);
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

  // Until every task is loaded the counts are the server's totals, not the number of rows read so far.
  const counts = { visible: itemsPaging.totalShown, hidden: itemsPaging.totalHidden };
  // Fall back to the main list when the Hidden list becomes empty (e.g. last item restored).
  const view: BacklogView = counts.hidden === 0 ? "visible" : selectedView;
  const inView = view === "hidden" ? hiddenItems : items;

  const { complete, loadAll } = itemsPaging;
  // The status cards, and any search or filter, have to look at every task, so the rest is read in the background right after the first rows are shown.
  useEffect(() => {
    if (!complete) loadAll();
  }, [complete, loadAll]);

  const matching = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return inView.filter(
      (i) =>
        (!q || i.title.toLowerCase().includes(q) || i.owner.toLowerCase().includes(q)) &&
        (!filters.priority || i.priority === filters.priority) &&
        (!filters.owner || i.owner === filters.owner) &&
        (!filters.sprint || i.sprint === filters.sprint) &&
        (!filters.deadlineFrom || (!!i.deadline && i.deadline >= filters.deadlineFrom)) &&
        (!filters.deadlineTo || (!!i.deadline && i.deadline <= filters.deadlineTo)),
    );
  }, [inView, filters]);
  // The table is that, narrowed to the chosen status. The status cards count the tasks that match every other filter, so a card always says how many rows its status would show.
  const visible = useMemo(() => (filters.status ? matching.filter((i) => i.status === filters.status) : matching), [matching, filters.status]);
  const otherFilters = Object.entries(filters).some(([key, value]) => key !== "status" && !!value);

  return (
    <div className="flex flex-col gap-6">
      <BacklogHeader />
      <StatusCards items={matching} selected={filters.status} onSelect={(status) => setFilters({ ...filters, status })} partial={!itemsPaging.complete} partialTotal={otherFilters ? undefined : itemsPaging.totalShown} />
      <BacklogFilters filters={filters} onChange={setFilters} options={{ ...STATIC_FILTER_OPTIONS, owner: owners, sprint: sprintNames.map((n) => ({ value: n, label: sprintLabel(n) })) }} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BacklogViewTabs view={view} onChange={setView} counts={counts} />
        {isAdmin && view === "hidden" && counts.hidden > 0 && (
          <button type="button" onClick={() => setRemovingHidden(true)} className="h-9 rounded-lg border border-red-500/40 px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-300">
            Remove all hidden
          </button>
        )}
      </div>
      <BacklogList
        items={visible}
        total={view === "hidden" ? counts.hidden : counts.visible}
        hasMore={itemsPaging.hasMore(view === "hidden")}
        loadingMore={itemsPaging.loadingMore}
        onLoadMore={() => itemsPaging.loadMore(view === "hidden")}
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
          consequence={deleting.ticketStats && deleting.ticketStats.total > 0 ? `Its ${deleting.ticketStats.total} child ${deleting.ticketStats.total === 1 ? "Ticket" : "Tickets"}, with their comments and images, will be deleted with it.` : undefined}
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
      {removingHidden && (
        <RemoveHiddenDialog
          count={counts.hidden}
          onClose={() => setRemovingHidden(false)}
          onConfirm={async () => {
            const r = await backlogService.removeHiddenItems();
            refreshItems();
            setView("visible");
            toast.show(`Removed ${r.tasks} hidden ${r.tasks === 1 ? "task" : "tasks"} and ${r.tickets} ${r.tickets === 1 ? "Ticket" : "Tickets"}${r.skipped ? `; ${r.skipped} in a closed sprint ${r.skipped === 1 ? "was" : "were"} kept` : ""}`);
          }}
        />
      )}
    </div>
  );
}
