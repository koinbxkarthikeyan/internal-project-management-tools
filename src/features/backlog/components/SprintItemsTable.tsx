"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { useHoverTip } from "@/components/ui/HoverTip";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline, initials } from "../utils";

type SprintItemsTableProps = {
  items: readonly BacklogItemData[];
  /** Opens the full details panel for a row. */
  onOpen: (item: BacklogItemData) => void;
  /** Opens the read-only history view for a row (the View button). */
  onView?: (item: BacklogItemData) => void;
  /** When given, rows get Up / Down arrows and can be dragged to a new place in this list: only the order inside the list changes. */
  onStep?: (item: BacklogItemData, direction: -1 | 1) => void;
  /** A row was dropped just before (or, with `after`, just after) another row of this list. */
  onDropRow?: (draggedId: string, targetId: string, after: boolean) => void;
  /** A row started (or stopped, with null) being dragged: the page also uses this to offer the other sections as drop targets. */
  onDragItem?: (item: BacklogItemData | null) => void;
  /** The task being dragged now (from any list), so its row can be dimmed and this list knows whether it is a row of its own. */
  draggingId?: string;
  /** A closed sprint: a row click opens the read-only view, not the edit panel. */
  readOnly?: boolean;
  /** A line under the title for a task that was carried between sprints ("Carried forward to BLG-12 · Sprint 10"), or nothing. */
  carryNote?: (item: BacklogItemData) => string | undefined;
};

const head = "px-4 py-2.5 text-left";

// The grip is one SVG: six dots in three rows, each row one colour. Only the three colours change with the kind of task.
// Carried = the backend recorded it as carried from another task; moved = its sprint history lists more than one sprint but it was not carried; new = neither.
const GRIP_KINDS = {
  carry: { rows: ["#6FB7F7", "#8EA2F2", "#4FD1C5"], label: "Carried task" },
  new: { rows: ["#5FD3A3", "#F2C94C", "#F6A860"], label: "New task" },
  move: { rows: ["#A98BF5", "#F29BC3", "#C4A0F0"], label: "Moved task" },
} as const;
type GripKind = keyof typeof GRIP_KINDS;
const gripKind = (item: BacklogItemData): GripKind => (item.carriedFrom ? "carry" : (item.historySprintIds?.length ?? 0) > 1 ? "move" : "new");

function TaskGrip({ kind }: { kind: GripKind }) {
  const { rows, label } = GRIP_KINDS[kind];
  return (
    <svg viewBox="0 0 12 18" width="10" height="15" role="img" aria-label={label} className="shrink-0 cursor-grab">
      <title>{label}</title>
      {rows.map((fill, row) =>
        [3, 9].map((cx) => <circle key={`${row}-${cx}`} cx={cx} cy={3 + row * 6} r="1.4" fill={fill} />),
      )}
    </svg>
  );
}

/** The tasks of one sprint as a table (Title, Type, Priority, Status, Owner, Deadline). Click a row to open it. */
export default function SprintItemsTable({ items, onOpen, onView, onStep, onDropRow, onDragItem, draggingId, readOnly = false, carryNote }: SprintItemsTableProps) {
  // Where a dragged row would land: before or after the row under the pointer (this list only).
  const [hover, setHover] = useState<{ id: string; after: boolean } | null>(null);
  const dragTip = useHoverTip();
  const ownDrag = !!draggingId && items.some((i) => i.id === draggingId);
  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>, item: BacklogItemData) {
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && onStep) {
      e.preventDefault();
      onStep(item, e.key === "ArrowUp" ? -1 : 1); // keyboard reordering: Alt + Up / Down, the same as the arrows
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(item);
    }
  }

  return (
    // About 10 rows are visible; the rest scroll inside the table, with the header kept in view.
    <div className="rt-box"><div className="table-scroll" style={{ "--row-h": "3.1rem" } as CSSProperties}>
      {dragTip.bubble}
      <table className="rt w-full min-w-[44rem] text-sm">
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
          {items.map((item) => {
            const draggable = !!onStep && !readOnly;
            const target = hover?.id === item.id && ownDrag && draggingId !== item.id ? hover : null;
            return (
            <tr
              key={item.id}
              draggable={draggable}
              // A row that can be dragged to another sprint says so on hover (not while something is being dragged, and not on rows that can't move).
              onMouseEnter={(e) => {
                if (draggable && onDragItem && !draggingId && item.status !== "Completed") {
                  dragTip.show(item.sprint === "Unplanned" ? "Drag and drop this task into an eligible sprint." : "Drag and drop this task into another eligible sprint or Backlog.", e);
                }
              }}
              onMouseMove={dragTip.move}
              onMouseLeave={dragTip.hide}
              onDragStart={(e) => {
                dragTip.hide();
                e.dataTransfer.setData("text/plain", item.id);
                e.dataTransfer.effectAllowed = "move";
                onDragItem?.(item);
              }}
              onDragEnd={() => (setHover(null), onDragItem?.(null))}
              // Over another row of the same list: a line shows where the dragged row will go. Over another list, the page's own drop target takes over.
              onDragOver={(e) => {
                if (!ownDrag || !onDropRow) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const box = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > box.top + box.height / 2;
                setHover((h) => (h && h.id === item.id && h.after === after ? h : { id: item.id, after }));
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHover((h) => (h?.id === item.id ? null : h))}
              onDrop={(e) => {
                if (!ownDrag || !onDropRow || !draggingId) return;
                e.preventDefault();
                e.stopPropagation();
                const at = hover;
                setHover(null);
                onDragItem?.(null);
                if (at) onDropRow(draggingId, item.id, at.after);
              }}
              tabIndex={0}
              onClick={() => onOpen(item)}
              onKeyDown={(e) => handleKeyDown(e, item)}
              aria-label={`${readOnly ? "View" : "Edit"} ${item.title}`}
              className={`group/row cursor-pointer transition-[background-color,opacity,box-shadow] duration-150 hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-accent ${draggable ? "active:cursor-grabbing" : ""} ${draggingId === item.id ? "bg-accent-soft/50 opacity-50 shadow-[inset_0_0_0_1px_var(--accent)]" : ""} ${target ? `bg-accent-soft ${target.after ? "shadow-[inset_0_-2px_0_var(--accent)]" : "shadow-[inset_0_2px_0_var(--accent)]"}` : ""}`}
            >
              <td data-primary className="max-w-xs px-4 py-2 font-medium">
                <div className="flex items-center gap-2">
                  {/* The grip: a row with it is dragged (anywhere on the row) to a new place in the list. */}
                  {draggable && (
                    <TaskGrip kind={gripKind(item)} />
                  )}
                  <div className="min-w-0">
                    <span className="block truncate">{item.title}</span>
                    {carryNote?.(item) && <span className="block truncate text-xs font-normal text-muted">{carryNote(item)}</span>}
                  </div>
                </div>
              </td>
              <td data-label="Type" className="whitespace-nowrap px-4 py-2 text-muted">{item.type ?? "–"}</td>
              <td data-label="Priority" className="px-4 py-2">
                <PriorityBadge priority={item.priority} />
              </td>
              <td data-label="Status" className="px-4 py-2">
                <StatusBadge status={item.status} />
              </td>
              <td data-label="Owner" className="px-4 py-2">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-medium text-accent" aria-hidden="true">
                    {initials(item.owner)}
                  </span>
                  <span className="truncate">{item.owner}</span>
                </span>
              </td>
              <td data-label="Deadline" className="whitespace-nowrap px-4 py-2 text-muted">
                <time dateTime={item.deadline}>{formatDeadline(item.deadline)}</time>
              </td>
              {onView && (
                <td data-actions className="whitespace-nowrap px-4 py-2 text-right">
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
            );
          })}
        </tbody>
      </table>
    </div>
</div>
  );
}

/** One compact arrow that moves the task one place up or down inside its own list. Disabled (with the reason as its tooltip) at the first / last row. */
