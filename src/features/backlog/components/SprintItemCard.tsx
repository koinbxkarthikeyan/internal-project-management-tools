import type { KeyboardEvent } from "react";
import PersonLabel from "@/components/ui/PersonLabel";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline } from "../utils";

type SprintItemCardProps = {
  item: BacklogItemData;
  onOpen: (item: BacklogItemData) => void;
};

/** Fixed-size (9rem) summary card: the title is clamped, nothing scrolls. Click opens the full details panel. */
export default function SprintItemCard({ item, onOpen }: SprintItemCardProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(item);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={handleKeyDown}
      aria-label={`Edit ${item.title}`}
      className="flex h-36 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-background/60 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2">
        <span />
        <StatusBadge status={item.status} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-1.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
        <div className="mt-1.5">
          <PriorityBadge priority={item.priority} />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
        <PersonLabel kind="owner" name={item.owner} size={20} className="gap-1.5" />
        <time dateTime={item.deadline} className="shrink-0 text-muted">
          {formatDeadline(item.deadline)}
        </time>
      </div>
    </div>
  );
}
