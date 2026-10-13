import { CheckCircleIcon, EditIcon, TrashIcon } from "@/components/ui/icons";
import type { Sprint } from "@/types/backlog";
import { formatDeadline } from "../utils";

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
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent";

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

/** Sprint section title with its status and the Close sprint, Edit and Delete options. */
export default function SprintHeaderTitle({ sprint, onEdit, onDelete, onClose, onStart, canStart }: SprintHeaderTitleProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2">
      <h2
        className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm font-semibold"
        title={sprint.goal || undefined}
      >
        {sprint.name}
        {sprint.start && sprint.end && (
          <span className="text-xs font-normal text-muted">
            {formatDeadline(sprint.start)} – {formatDeadline(sprint.end)}
          </span>
        )}
      </h2>
      {sprint.status && (
        <span
          className={`${pill} ${
            sprint.status === "Active"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : sprint.status === "Paused"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${sprint.status === "Active" ? "bg-emerald-500" : sprint.status === "Paused" ? "bg-amber-500" : "bg-slate-400"}`}
            aria-hidden="true"
          />
          {sprint.status}
        </span>
      )}
      {sprint.name !== "Unplanned" && (
        <>
          {sprint.status === "Active" && (
            <button type="button" onClick={() => onClose(sprint)} aria-label={`Close ${sprint.name}`} className={`${action} hover:text-accent`}>
              <CheckCircleIcon width={14} height={14} />
              Close sprint
            </button>
          )}
          {sprint.status === "Paused" && onStart && (
            <button
              type="button"
              onClick={() => onStart(sprint)}
              disabled={!canStart}
              title={canStart ? undefined : "Another sprint is still running"}
              aria-label={`Start ${sprint.name}`}
              className={`${action} hover:text-accent disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <CheckCircleIcon width={14} height={14} />
              Start sprint
            </button>
          )}
          {/* A closed sprint is history: it is viewed, not edited or deleted. */}
          {sprint.status !== "Closed" && (
            <>
              <button type="button" onClick={() => onEdit(sprint)} aria-label={`Edit ${sprint.name}`} className={`${action} hover:text-accent`}>
                <EditIcon width={14} height={14} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(sprint)}
                aria-label={`Delete ${sprint.name}`}
                className={`${action} hover:text-red-600 dark:hover:text-red-300`}
              >
                <TrashIcon width={14} height={14} />
                Delete
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
