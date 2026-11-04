import type { Priority, Status } from "@/types/backlog";
import { statusLabel } from "@/constants/backlog-options";

const base =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/20",
  High: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/15 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/20",
  Medium: "bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-400/20",
  Low: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/15 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/20",
  "Not set": "bg-transparent text-muted ring-1 ring-inset ring-border",
};

const STATUS_STYLES: Record<Status, { pill: string; dot: string }> = {
  Open: { pill: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/20", dot: "bg-blue-500" },
  "In progress": { pill: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/15 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20", dot: "bg-indigo-500" },
  "Ready for QA": { pill: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/15 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/20", dot: "bg-teal-500" },
  Testing: { pill: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/15 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/20", dot: "bg-violet-500" },
  Blocked: { pill: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/20", dot: "bg-red-500" },
  "On hold": { pill: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20", dot: "bg-amber-500" },
  Done: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20", dot: "bg-emerald-500" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`${base} ${PRIORITY_STYLES[priority]}`}>{priority}</span>;
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`${base} ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
