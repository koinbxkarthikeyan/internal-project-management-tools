"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline, initials } from "../utils";

type SprintItemsTableProps = {
  items: readonly BacklogItemData[];
  /** Opens the full details panel for a row. */
  onOpen: (item: BacklogItemData) => void;
  /** Opens the read-only history view for a row (the View button). */
  onView?: (item: BacklogItemData) => void;
  /** A closed sprint: a row click opens the read-only view, not the edit panel. */
  readOnly?: boolean;
};

const head = "px-4 py-2.5 text-left";

/** The tasks of one sprint as a table (Title, Type, Priority, Status, Owner, Deadline). Click a row to open it. */
export default function SprintItemsTable({ items, onOpen, onView, readOnly = false }: SprintItemsTableProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>, item: BacklogItemData) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(item);
    }
  }

  return (
    // About 10 rows are visible; the rest scroll inside the table, with the header kept in view.
    <div className="table-scroll" style={{ "--row-h": "3.1rem" } as CSSProperties}>
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">Tasks in this sprint</caption>
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
            <th scope="col" className={head}>Title</th>
            <th scope="col" className={head}>Type</th>
            <th scope="col" className={head}>Priority</th>
            <th scope="col" className={head}>Status</th>
            <th scope="col" className={head}>Owner</th>
            <th scope="col" className={head}>Deadline</th>
            {onView && <th scope="col" className={`${head} text-right`}>Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr
              key={item.id}
              tabIndex={0}
              onClick={() => onOpen(item)}
              onKeyDown={(e) => handleKeyDown(e, item)}
              aria-label={`${readOnly ? "View" : "Edit"} ${item.title}`}
              className="cursor-pointer transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              <td className="max-w-xs truncate px-4 py-2 font-medium">{item.title}</td>
              <td className="whitespace-nowrap px-4 py-2 text-muted">{item.type ?? "–"}</td>
              <td className="px-4 py-2">
                <PriorityBadge priority={item.priority} />
              </td>
              <td className="px-4 py-2">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-2">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-medium text-accent" aria-hidden="true">
                    {initials(item.owner)}
                  </span>
                  <span className="truncate">{item.owner}</span>
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-muted">
                <time dateTime={item.deadline}>{formatDeadline(item.deadline)}</time>
              </td>
              {onView && (
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  {/* Stops the row's own click, which opens the edit panel. */}
                  <button
                    type="button"
                    onClick={(e) => (e.stopPropagation(), onView(item))}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={`View ${item.title}`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    View
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
