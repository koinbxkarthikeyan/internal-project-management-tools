"use client";

import CommentsCard from "@/features/comments/CommentsCard";
import ViewTaskDrawer from "@/features/work/components/ViewTaskDrawer";
import type { BacklogItemData } from "@/types/backlog";

/** A task that has no Tickets section yet (To Do, In Progress): its details on the left and its comments on the right, side by side from a large screen and stacked (details first) on a small one. */
export default function TaskDetailsColumns({ item, onChanged, onBack }: { item: BacklogItemData; onChanged: () => void; onBack: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="min-w-0">
        <ViewTaskDrawer key={`${item.id}:${item.status}`} inline hideComments item={item} onClose={onBack} onSaved={onChanged} />
      </div>
      <div className="min-w-0 lg:sticky lg:top-4">
        <CommentsCard taskId={item.id} fill reloadToken={Date.parse(item.updatedAt ?? "") || 0} />
      </div>
    </div>
  );
}
