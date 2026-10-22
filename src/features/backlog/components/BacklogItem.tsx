"use client";

import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline, initials } from "../utils";
import { useBacklog } from "../context/BacklogContext";
import ActionsMenu from "@/components/ui/ActionsMenu";
import { EyeIcon } from "@/components/ui/icons";
import TaskHistoryModal from "@/features/work/components/TaskHistoryModal";
import RowActionsMenu from "./RowActionsMenu";
import { ROW_GRID } from "./rowGrid";

export { ROW_GRID };

export type BacklogItemActions = {
  onEdit: (item: BacklogItemData) => void;
  onDelete: (item: BacklogItemData) => void;
  onToggleHidden: (item: BacklogItemData) => void;
};

type BacklogItemProps = {
  item: BacklogItemData;
  /** When omitted the row is read-only (no deadline input or action buttons). */
  actions?: BacklogItemActions;
  /** Plays the exit animation (used just before hide/restore/delete is applied). */
  leaving?: boolean;
  /** Row position, used to stagger the entry animation. */
  index?: number;
};

export default function BacklogItem({ item, actions, leaving = false, index = 0 }: BacklogItemProps) {
  const { allPods, sprints, items, hiddenItems } = useBacklog();
  // A task of a closed sprint is read-only: a click (or the menu) opens View instead of Edit, and Hide / Delete are not offered.
  const closed = sprints.some((s) => s.name === item.sprint && s.status === "Closed");
  const [viewing, setViewing] = useState(false);
  const pod = item.podId ? allPods.find((p) => p.id === item.podId)?.name : undefined;
  // A visible row opens the Edit panel when clicked anywhere (the ⋯ menu keeps its own clicks). Hidden rows don't.
  const openable = !!actions && (closed || !item.hidden);
  const open = () => (closed ? setViewing(true) : actions?.onEdit(item));

  return (
    <li
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
      {...(openable
        ? {
            onClick: (e: MouseEvent<HTMLLIElement>) => {
              if (!(e.target as HTMLElement).closest("[data-row-actions]")) open();
            },
            onKeyDown: (e: KeyboardEvent<HTMLLIElement>) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                open();
              }
            },
            tabIndex: 0,
            "aria-label": `${closed ? "View" : "Edit"} ${item.title}`,
          }
        : {})}
      className={`flex flex-col gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-hover ${
        openable ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-accent" : ""
      } ${leaving ? "anim-row-out" : "anim-row-in"} ${ROW_GRID}`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {item.comments} {item.comments === 1 ? "comment" : "comments"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:contents">
        <div>
          <PriorityBadge priority={item.priority} />
        </div>
        <div>
          <StatusBadge status={item.status} />
        </div>
        <span className="text-sm text-muted">
          {item.sprint}
          {pod && <span className="block text-xs">{pod}</span>}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm md:contents">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent"
            aria-hidden="true"
          >
            {initials(item.owner)}
          </span>
          <span className="truncate">{item.owner}</span>
        </div>
        <time dateTime={item.deadline} className="whitespace-nowrap text-muted">
          <span className="md:sr-only">Due </span>
          {formatDeadline(item.deadline)}
        </time>
      </div>

      {actions ? (
        <div data-row-actions className="flex items-center justify-end text-muted">
          {closed ? (
            <ActionsMenu label={`Actions for ${item.title}`} actions={[{ key: "view", label: "View", icon: <EyeIcon />, onSelect: () => setViewing(true) }]} />
          ) : (
            <RowActionsMenu item={item} onToggleHidden={() => actions.onToggleHidden(item)} onDelete={() => actions.onDelete(item)} />
          )}
        </div>
      ) : (
        <div />
      )}
      {viewing && <TaskHistoryModal item={item} allTasks={[...items, ...hiddenItems]} allSprints={sprints} onClose={() => setViewing(false)} />}
    </li>
  );
}
