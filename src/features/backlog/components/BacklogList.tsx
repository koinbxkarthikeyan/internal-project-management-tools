import type { CSSProperties } from "react";
import EmptyState from "@/components/ui/EmptyState";
import type { BacklogItemData } from "@/types/backlog";
import BacklogItem, { ROW_GRID, type BacklogItemActions } from "./BacklogItem";

type BacklogListProps = {
  items: readonly BacklogItemData[];
  total: number;
  actions?: BacklogItemActions;
  /** Ids currently playing their exit animation. */
  leavingIds?: ReadonlySet<string>;
  /** Shown when there is no data at all (as opposed to nothing matching the filters). */
  emptyTitle?: string;
  emptyMessage?: string;
};

const COLUMNS = ["Title", "Priority", "Status", "Sprint", "Owner", "Deadline", "Actions"];

export default function BacklogList({ items, total, actions, leavingIds, emptyTitle = "No items yet", emptyMessage }: BacklogListProps) {
  return (
    <section
      aria-label="Backlog items"
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div
        className={`hidden border-b border-border bg-background/60 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted ${ROW_GRID}`}
        aria-hidden="true"
      >
        {COLUMNS.map((c, i) => (
          <span key={i} className={c === "Actions" ? "text-right" : undefined}>{c}</span>
        ))}
      </div>

      {items.length === 0 ? (
        total === 0 ? (
          <EmptyState title={emptyTitle} description={emptyMessage} />
        ) : (
          <EmptyState title="No matching items" description="Try changing your search or filters." />
        )
      ) : (
        <ul className="table-scroll divide-y divide-border" style={{ "--row-h": "4.6rem", "--head-h": "0rem" } as CSSProperties}>
          {items.map((item, index) => (
            <BacklogItem
              key={item.id}
              item={item}
              actions={actions}
              index={index}
              leaving={leavingIds?.has(item.id)}
            />
          ))}
        </ul>
      )}

      <p className="border-t border-border px-4 py-2.5 text-xs text-muted" aria-live="polite">
        Showing {items.length} of {total} items
      </p>
    </section>
  );
}
