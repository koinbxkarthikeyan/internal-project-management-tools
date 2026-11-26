"use client";

import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import PersonLabel from "@/components/ui/PersonLabel";
import { PriorityBadge, StatusBadge, TypeLabel } from "@/components/ui/Badge";
import type { BacklogItemData } from "@/types/backlog";
import { formatDeadline } from "../utils";
import { useBacklog } from "../context/BacklogContext";
import ReopenedBadge from "./ReopenedBadge";
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
  /** A button or two in the actions column of a read-only row (the Done page's Reopen). */
  rowAction?: ReactNode;
  /** Plays the exit animation (used just before hide/restore/delete is applied). */
  leaving?: boolean;
  /** Row position, used to stagger the entry animation. */
  index?: number;
};

export default function BacklogItem({ item, actions, rowAction, leaving = false, index = 0 }: BacklogItemProps) {
  const { allPods, sprints, items, hiddenItems } = useBacklog();
  // A task of a closed sprint is read-only: a click (or the menu) opens View instead of Edit, and Hide / Delete are not offered.
  const closed = sprints.some((s) => s.name === item.sprint && s.status === "Closed");
  const [viewing, setViewing] = useState(false);
  const colour = sprintColour(item.sprint);
  const pod = item.podId ? allPods.find((p) => p.id === item.podId)?.name : undefined;
  // A visible row opens the Edit panel when clicked anywhere (the ⋯ menu keeps its own clicks). Hidden rows don't.
  // A read-only list (no actions) of delivered tasks, like Done, opens View too, so its details and history can be read in full.
  const viewOnly = closed || (!actions && item.status === "Done");
  const openable = viewOnly || (!!actions && !item.hidden);
  const open = () => (viewOnly ? setViewing(true) : actions?.onEdit(item));

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
            "aria-label": `${viewOnly ? "View" : "Edit"} ${item.title}`,
          }
        : {})}
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-4 py-3 transition-colors duration-150 hover:bg-row-hover @4xl:py-2 ${
        openable ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-accent" : ""
      } ${leaving ? "anim-row-out" : "anim-row-in"} ${ROW_GRID}`}
    >
      {/* Narrow screens show the row as a card: the title and the actions in the header, then one label / value line per column. */}
      <div className="col-start-1 row-start-1 min-w-0 @4xl:col-auto @4xl:row-auto">
        <p className="flex items-center gap-2 text-sm font-medium"><span className="min-w-0 break-words @4xl:truncate">{item.title}</span><ReopenedBadge item={item} /></p>
      </div>

      <div className="col-span-2 mt-1 flex flex-col gap-1.5 border-t border-border pt-2 @4xl:contents @4xl:mt-0 @4xl:border-0 @4xl:pt-0">
        <div className="flex items-center justify-between gap-3 @4xl:contents">
          <span className="text-xs text-muted @4xl:hidden">Type</span>
          <span className="text-sm text-muted"><TypeLabel type={item.type} /></span>
        </div>
        <div className="flex items-center justify-between gap-3 @4xl:contents">
          <span className="text-xs text-muted @4xl:hidden">Priority</span>
          <div>
            <PriorityBadge priority={item.priority} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 @4xl:contents">
          <span className="text-xs text-muted @4xl:hidden">Status</span>
          <div>
            <StatusBadge status={item.status} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 @4xl:contents">
          <span className="text-xs text-muted @4xl:hidden">Sprint</span>
          <span className="text-right text-sm text-muted @4xl:text-left">
            <span className={`${colour.pill} items-center gap-1.5`}><span className={`h-2 w-2 shrink-0 rounded-full ${colour.dot}`} aria-hidden="true" />{sprintLabel(item.sprint)}</span>
            {pod && <span className="block text-xs">{pod}</span>}
          </span>
        </div>
      </div>

      <div className="col-span-2 flex flex-col gap-1.5 text-sm @4xl:contents">
        <div className="flex items-center justify-between gap-3 @4xl:contents">
          <span className="text-xs text-muted @4xl:hidden">Owner</span>
          <PersonLabel kind="owner" name={item.owner} />
        </div>
        <div className="flex items-center justify-between gap-3 @4xl:contents">
          <span className="text-xs text-muted @4xl:hidden">Expected ETA</span>
          <time dateTime={item.deadline} className="whitespace-nowrap text-muted">
            <span className="sr-only">Expected ETA </span>
            {formatDeadline(item.deadline)}
          </time>
        </div>
      </div>

      {actions ? (
        <div data-row-actions className="col-start-2 row-start-1 flex items-center justify-end self-start text-muted @4xl:col-auto @4xl:row-auto @4xl:self-auto">
          {closed ? (
            <ActionsMenu label={`Actions for ${item.title}`} actions={[{ key: "view", label: "View", icon: <EyeIcon />, onSelect: () => setViewing(true) }]} />
          ) : (
            <RowActionsMenu item={item} onToggleHidden={() => actions.onToggleHidden(item)} onDelete={() => actions.onDelete(item)} />
          )}
        </div>
      ) : rowAction ? (
        <div data-row-actions className="col-start-2 row-start-1 flex items-center justify-end self-start @4xl:col-auto @4xl:row-auto @4xl:self-auto">{rowAction}</div>
      ) : viewOnly ? (
        <div data-row-actions className="col-start-2 row-start-1 flex items-center justify-end self-start text-muted @4xl:col-auto @4xl:row-auto @4xl:self-auto">
          <ActionsMenu label={`Actions for ${item.title}`} actions={[{ key: "view", label: "View", icon: <EyeIcon />, onSelect: () => setViewing(true) }]} />
        </div>
      ) : (
        <div className="hidden @4xl:block" />
      )}
      {viewing && <TaskHistoryModal item={item} allTasks={[...items, ...hiddenItems]} allSprints={sprints} onClose={() => setViewing(false)} />}
    </li>
  );
}
