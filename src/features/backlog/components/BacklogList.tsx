import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
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
  /** Shown at the top of the table, above the column headings (the group tabs). */
  header?: ReactNode;
  /** More rows can be read from the server: the next page is asked for when the end of the list is scrolled into view. */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

const COLUMNS = ["Title", "Type", "Priority", "Status", "Sprint", "Owner", "Deadline", "Actions"];

export default function BacklogList({ items, total, actions, leavingIds, emptyTitle = "No items yet", emptyMessage, header, hasMore = false, loadingMore = false, onLoadMore }: BacklogListProps) {
  const scroller = useRef<HTMLUListElement>(null);
  const end = useRef<HTMLLIElement>(null);
  // The end of the list comes into view (by scrolling, or because the rows do not fill the table): ask for the next page, once, and only if none is already loading.
  // Created again after every page, so a list that still shows its end asks again.
  useEffect(() => {
    const target = end.current;
    if (!hasMore || loadingMore || !onLoadMore || !target) return;
    const watcher = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onLoadMore(), { root: scroller.current, rootMargin: "0px" });
    watcher.observe(target);
    return () => watcher.disconnect();
  }, [hasMore, loadingMore, onLoadMore, items.length]);

  return (
    <section
      aria-label="Backlog items"
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {header}
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
        <ul ref={scroller} className="table-scroll divide-y divide-border" style={{ "--row-h": "3.4rem", "--head-h": "0rem" } as CSSProperties}>
          {items.map((item, index) => (
            <BacklogItem
              key={item.id}
              item={item}
              actions={actions}
              index={index}
              leaving={leavingIds?.has(item.id)}
            />
          ))}
          {(hasMore || loadingMore) && (
            <li ref={end} className="flex items-center justify-center gap-2 px-4 py-3 text-xs text-muted" aria-live="polite">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden="true" />
              Loading more…
            </li>
          )}
        </ul>
      )}

      <p className="border-t border-border px-4 py-2.5 text-xs text-muted" aria-live="polite">
        Showing {items.length} of {total} items
      </p>
    </section>
  );
}
