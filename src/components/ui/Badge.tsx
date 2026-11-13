import type { ReactNode } from "react";
import type { ItemType, Priority, Status } from "@/types/backlog";
import { statusLabel } from "@/constants/backlog-options";

const base =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

// Four clearly different hues, so priorities can be told apart at a glance: red, orange, blue, teal.
const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: "text-red-600 dark:text-red-400",
  High: "text-orange-500 dark:text-orange-400",
  Medium: "text-blue-600 dark:text-blue-400",
  Low: "text-teal-600 dark:text-teal-400",
  "Not set": "bg-transparent text-muted ring-1 ring-inset ring-border",
};

// Status hues differ from the priority ones: slate (not started), violet (under way), rose (blocked), amber (waiting), green (done).
const STATUS_STYLES: Record<Status, { pill: string }> = {
  Open: { pill: "text-slate-600 dark:text-slate-300" },
  "In progress": { pill: "text-violet-600 dark:text-violet-400" },
  Blocked: { pill: "text-rose-600 dark:text-rose-400" },
  "On hold": { pill: "text-amber-600 dark:text-amber-400" },
  Completed: { pill: "text-emerald-600 dark:text-emerald-400" },
};

const PRIORITY_PATHS: Record<Priority, string> = {
  Critical: "m6 11 6-6 6 6M6 18l6-6 6 6", // two chevrons up
  High: "M12 19V5m-6 6 6-6 6 6", // arrow up
  Medium: "M5 9h14M5 15h14", // equals
  Low: "M12 5v14m-6-6 6 6 6-6", // arrow down
  "Not set": "M7 12h10", // a dash
};

/** The priority as a small icon (up for urgent, down for low) and its name, in the priority's colour. */
export function PriorityIcon({ priority }: { priority: Priority }) {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={PRIORITY_PATHS[priority]} />
    </svg>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`${base} ${PRIORITY_STYLES[priority]}`}>
      <PriorityIcon priority={priority} />
      {priority}
    </span>
  );
}

const STATUS_PATHS: Record<Status, ReactNode> = {
  Open: <circle cx="12" cy="12" r="8" />, // an empty circle: not started
  "In progress": (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </>
  ), // a clock: under way
  Blocked: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m6.3 6.3 11.4 11.4" />
    </>
  ), // a circle with a bar through it
  "On hold": <path d="M9 6v12M15 6v12" />, // pause
  Completed: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
    </>
  ), // a ticked circle
};

/** The status as a small icon (empty circle, clock, blocked, pause, tick). */
export function StatusIcon({ status }: { status: Status }) {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {STATUS_PATHS[status]}
    </svg>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`${base} ${s.pill}`}>
      <StatusIcon status={status} />
      {statusLabel(status)}
    </span>
  );
}

const TYPE_PATHS: Record<ItemType, ReactNode> = {
  Feature: <path d="M12 3.5l2.4 5.2 5.6.7-4.1 3.9 1.1 5.6L12 16.1l-5 2.8 1.1-5.6L4 9.4l5.6-.7z" />, // a star: something new
  Enhancement: <path d="M7 17 17 7M9 7h8v8" />, // an arrow up and out: better
  Task: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
    </>
  ), // a ticked box
  Bug: (
    <>
      <rect x="8" y="8" width="8" height="11" rx="4" />
      <path d="M12 8V6m-4 6H5m14 0h-3m-8 4-3 2m11-2 3 2M9 5l1.5 1.5M15 5l-1.5 1.5" />
    </>
  ), // a beetle
  "Tech Debt": <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.3-.7-.7-2.3z" />, // a spanner
};

/** The task type as a small icon (star, arrow, tick, bug, spanner) and its name, in the same muted text the column had; "–" when there is none. */
export function TypeLabel({ type }: { type?: ItemType }) {
  if (!type) return <span>–</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
        {TYPE_PATHS[type]}
      </svg>
      {type}
    </span>
  );
}
