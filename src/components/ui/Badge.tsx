import type { Priority, Status } from "@/types/backlog";
import { statusLabel } from "@/constants/backlog-options";

const base =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
  "Not set": "bg-transparent text-muted ring-1 ring-inset ring-border",
};

const STATUS_STYLES: Record<Status, { pill: string; dot: string }> = {
  Open: { pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", dot: "bg-blue-500" },
  "In progress": { pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
  Blocked: { pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", dot: "bg-red-500" },
  "On hold": { pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" },
  Completed: { pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" },
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
