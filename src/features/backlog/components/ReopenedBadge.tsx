import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline } from "../utils";

/** A small "Reopened" tag (an outlined rose chip with a "back" arrow: a different colour and shape from every status and priority pill) for a task or Ticket that was completed, reopened, and is open again. It goes away when the item is completed again. */
export const isReopened = (item: Pick<BacklogItemData, "status" | "reopenedAt">) => !!item.reopenedAt && item.status !== "Done";

export default function ReopenedBadge({ item }: { item: Pick<BacklogItemData, "status" | "reopenedAt"> }) {
  if (!isReopened(item)) return null;
  return (
    <span
      title={`Reopened ${item.reopenedAt ? formatDeadline(item.reopenedAt) : ""}`.trim()}
      className="inline-flex shrink-0 items-center rounded-full gap-1 bg-transparent px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-inset ring-rose-400 dark:text-rose-300 dark:ring-rose-400/70"
    >
      <span aria-hidden="true">↺</span> Reopened
    </span>
  );
}
