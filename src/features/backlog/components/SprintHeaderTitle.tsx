import { DisabledTip } from "@/components/ui/DisabledTip";
import { CheckCircleIcon, EditIcon, TrashIcon } from "@/components/ui/icons";
import type { Sprint } from "@/types/backlog";
import { formatDeadline } from "../utils";
import { sprintLabel } from "@/constants/backlog-options";

type SprintHeaderTitleProps = {
  sprint: Sprint;
  /** Opens the Edit sprint side panel. */
  onEdit: (sprint: Sprint) => void;
  /** Opens the delete confirmation side panel. */
  onDelete: (sprint: Sprint) => void;
  /** Opens the close-sprint confirmation side panel (shown for the running sprint only). */
  onClose: (sprint: Sprint) => void;
  /** Starts a Paused sprint. Omitted/disabled while another sprint is running. */
  onStart?: (sprint: Sprint) => void;
  canStart?: boolean;
};

const action =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent max-sm:p-2";

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

/** Sprint section title with its status and the Close sprint, Edit and Delete options. */
export default function SprintHeaderTitle({ sprint, onEdit, onDelete, onClose, onStart, canStart }: SprintHeaderTitleProps) {
  return (
    <div className="flex min-w-0 items-center gap-x-2 sm:flex-wrap">
      <h2
        className="flex min-w-0 items-baseline gap-x-2 text-sm font-semibold sm:flex-wrap"
        title={sprint.goal || undefined}
      >
        <span className="min-w-0 truncate">{sprintLabel(sprint.name)}</span>
        {sprint.start && sprint.end && (
          <span className="text-xs font-normal text-muted max-sm:hidden">
            {formatDeadline(sprint.start)} – {formatDeadline(sprint.end)}
          </span>
        )}
      </h2>
      {sprint.status && (
        <span
          title={sprint.status === "Paused" ? "Planned" : sprint.status}
          className={`${pill} max-sm:bg-transparent max-sm:px-0 max-sm:dark:bg-transparent ${
            sprint.status === "Active"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : sprint.status === "Paused"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full max-sm:h-2.5 max-sm:w-2.5 ${sprint.status === "Active" ? "bg-emerald-500" : sprint.status === "Paused" ? "bg-amber-500" : "bg-slate-400"}`}
            aria-hidden="true"
          />
          <span className="max-sm:sr-only">{sprint.status === "Paused" ? "Planned" : sprint.status}</span>
        </span>
      )}
      {sprint.name !== "Unplanned" && (
        <>
          {sprint.status === "Active" && (
            <button type="button" onClick={() => onClose(sprint)} aria-label={`Close ${sprint.name}`} title={`Close ${sprint.name}`} className={`${action} hover:text-accent`}>
              <CheckCircleIcon width={14} height={14} />
              <span className="max-sm:sr-only">Close sprint</span>
            </button>
          )}
          {sprint.status === "Paused" && onStart && (
            <DisabledTip reason={!canStart && "Another sprint is still running. Close it first to start this one."} className="inline-block">
            <button
              type="button"
              onClick={() => onStart(sprint)}
              disabled={!canStart}
              aria-label={`Start ${sprint.name}`}
              title={`Start ${sprint.name}`}
              className={`${action} hover:text-accent disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <CheckCircleIcon width={14} height={14} />
              <span className="max-sm:sr-only">Start sprint</span>
            </button>
            </DisabledTip>
          )}
          {/* A closed sprint is history: it is viewed, not edited or deleted. */}
          {sprint.status !== "Closed" && (
            <>
              <button type="button" onClick={() => onEdit(sprint)} aria-label={`Edit ${sprint.name}`} title={`Edit ${sprint.name}`} className={`${action} hover:text-accent`}>
                <EditIcon width={14} height={14} />
                <span className="max-sm:sr-only">Edit</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(sprint)}
                aria-label={`Delete ${sprint.name}`}
                title={`Delete ${sprint.name}`}
                className={`${action} hover:text-red-600 dark:hover:text-red-300`}
              >
                <TrashIcon width={14} height={14} />
                <span className="max-sm:sr-only">Delete</span>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
