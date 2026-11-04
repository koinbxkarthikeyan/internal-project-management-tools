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
import { sprintLabel } from "@/constants/backlog-options";
import { sprintColour } from "../sprintColours";

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
  const colour = sprintColour(item.sprint);
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
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-4 py-3 transition-colors duration-150 hover:bg-row-hover md:py-2 ${
        openable ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-accent" : ""
      } ${leaving ? "anim-row-out" : "anim-row-in"} ${ROW_GRID}`}
    >
      {/* Narrow screens show the row as a card: the title and the actions in the header, then one label / value line per column. */}
      <div className="col-start-1 row-start-1 min-w-0 md:col-auto md:row-auto">
        <p className="break-words text-sm font-medium md:truncate">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {item.comments} {item.comments === 1 ? "comment" : "comments"}
        </p>
      </div>

      <div className="col-span-2 mt-1 flex flex-col gap-1.5 border-t border-border pt-2 md:contents md:mt-0 md:border-0 md:pt-0">
        <div className="flex items-center justify-between gap-3 md:contents">
          <span className="text-xs text-muted md:hidden">Type</span>
          <span className="text-sm text-muted">{item.type ?? "–"}</span>
        </div>
        <div className="flex items-center justify-between gap-3 md:contents">
          <span className="text-xs text-muted md:hidden">Priority</span>
          <div>
            <PriorityBadge priority={item.priority} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 md:contents">
          <span className="text-xs text-muted md:hidden">Status</span>
          <div>
            <StatusBadge status={item.status} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 md:contents">
          <span className="text-xs text-muted md:hidden">Sprint</span>
          <span className="text-right text-sm text-muted md:text-left">
            <span className={`${colour.pill} items-center gap-1.5`}><span className={`h-2 w-2 shrink-0 rounded-full ${colour.dot}`} aria-hidden="true" />{sprintLabel(item.sprint)}</span>
            {pod && <span className="block text-xs">{pod}</span>}
          </span>
        </div>
      </div>

      <div className="col-span-2 flex flex-col gap-1.5 text-sm md:contents">
        <div className="flex items-center justify-between gap-3 md:contents">
          <span className="text-xs text-muted md:hidden">Owner</span>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-medium text-accent"
              aria-hidden="true"
            >
              {initials(item.owner)}
            </span>
            <span className="truncate">{item.owner}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 md:contents">
          <span className="text-xs text-muted md:hidden">Deadline</span>
          <time dateTime={item.deadline} className="whitespace-nowrap text-muted">
            <span className="sr-only">Due </span>
            {formatDeadline(item.deadline)}
          </time>
        </div>
      </div>

      {actions ? (
        <div data-row-actions className="col-start-2 row-start-1 flex items-center justify-end self-start text-muted md:col-auto md:row-auto md:self-auto">
          {closed ? (
            <ActionsMenu label={`Actions for ${item.title}`} actions={[{ key: "view", label: "View", icon: <EyeIcon />, onSelect: () => setViewing(true) }]} />
          ) : (
            <RowActionsMenu item={item} onToggleHidden={() => actions.onToggleHidden(item)} onDelete={() => actions.onDelete(item)} />
          )}
        </div>
      ) : (
        <div className="hidden md:block" />
      )}
      {viewing && <TaskHistoryModal item={item} allTasks={[...items, ...hiddenItems]} allSprints={sprints} onClose={() => setViewing(false)} />}
    </li>
  );
}
