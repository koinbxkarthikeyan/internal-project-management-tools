import type { ReactNode } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { statusLabel } from "@/constants/backlog-options";
import { formatDeadline } from "@/features/backlog/utils";
import { formatHours, formatDay } from "@/features/work/utils";
import type { BacklogItemData, Status } from "@/types/backlog";
import type { WorkEntry } from "@/types/work";
import type { Activity } from "../stats";

const card = "rounded-2xl border border-border bg-surface p-5";
/** The same colours the status badges use. */
export const STATUS_COLOR: Record<Status, string> = { Open: "#4a8fe0", "In progress": "#a78bfa", Blocked: "#ff5c52", "On hold": "#f5a524", Completed: "#5fcf8e" };

export function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={`${card} flex min-w-0 flex-col gap-4`}>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "text-foreground" }: { label: string; value: ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={`mt-1 truncate text-2xl font-semibold tabular-nums ${tone}`}>{value}</dd>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ percent, label, color = "var(--accent, #2563eb)" }: { percent: number; label: string; color?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-hover">
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

/** The tasks by status: one stacked bar, then a line per status with its count and share. */
export function StatusChart({ byStatus, total }: { byStatus: { status: Status; count: number }[]; total: number }) {
  if (total === 0) return <EmptyState compact title="No tasks to chart" description="Tasks assigned to you show here by status." />;
  return (
    <>
      <div role="img" aria-label="Tasks by status" className="flex h-3 overflow-hidden rounded-full bg-hover">
        {byStatus.filter((s) => s.count > 0).map((s) => (
          <span key={s.status} title={`${statusLabel(s.status)}: ${s.count}`} className="h-full border-r border-surface last:border-r-0" style={{ width: `${(s.count / total) * 100}%`, background: STATUS_COLOR[s.status] }} />
        ))}
      </div>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {byStatus.map((s) => (
          <li key={s.status} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STATUS_COLOR[s.status] }} aria-hidden="true" />
              <span className="truncate">{statusLabel(s.status)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-semibold text-foreground">{s.count}</span> · {Math.round((s.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Columns scaled to the largest value (never to a made-up maximum); a column with 0 stays an empty slot. */
export function BarChart({ bars, label }: { bars: { key: string; label: string; title: string; value: number }[]; label: string }) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (bars.length === 0 || max === 0) return <EmptyState compact title="No hours logged" description="Hours you log in this range show here." />;
  return (
    <div role="img" aria-label={label} className="flex h-36 items-end gap-1.5 overflow-x-auto pb-1">
      {bars.map((b) => (
        <div key={b.key} title={b.title} className="flex h-full min-w-5 max-w-16 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-muted">{b.value > 0 ? Math.round(b.value * 10) / 10 : ""}</span>
          <span className="w-full rounded-t bg-accent" style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value > 0 ? 2 : 0 }} />
          <span className="text-[10px] text-muted">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function RecentWork({ entries, sprintName }: { entries: readonly WorkEntry[]; sprintName: (id: string) => string }) {
  if (entries.length === 0) return <EmptyState compact title="No work logged" description="Entries you add on Log Work Sprint show here." />;
  return (
    <ul className="divide-y divide-border text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="min-w-0">
            <span className="block truncate font-medium">{e.task || "Other work"}</span>
            <span className="block truncate text-xs text-muted">
              {formatDay(e.from)}{e.to !== e.from ? ` → ${formatDay(e.to)}` : ""} · {sprintName(e.sprintId)}
            </span>
          </span>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">{formatHours(e.hours)}</span>
        </li>
      ))}
    </ul>
  );
}

export function RecentCompleted({ tasks }: { tasks: readonly BacklogItemData[] }) {
  if (tasks.length === 0) return <EmptyState compact title="Nothing completed yet" description="Tasks you finish show here." />;
  return (
    <ul className="divide-y divide-border text-sm">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="min-w-0 truncate font-medium">{t.title}</span>
          <span className="shrink-0 text-xs text-muted">{t.completed ? formatDeadline(t.completed) : ""}</span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityList({ activity }: { activity: readonly Activity[] }) {
  if (activity.length === 0) return <EmptyState compact title="No recent activity" description="Assignments, status changes and logged work show here." />;
  return (
    <ul className="divide-y divide-border text-sm">
      {activity.map((a, i) => (
        <li key={`${a.at}-${i}`} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="min-w-0">
            <span className="block text-xs font-medium text-accent">{a.kind}</span>
            <span className="block break-words">{a.text}</span>
            {a.by && <span className="block text-xs text-muted">by {a.by}</span>}
          </span>
          <span className="shrink-0 text-xs text-muted">{a.at ? formatDeadline(a.at.slice(0, 10)) : ""}</span>
        </li>
      ))}
    </ul>
  );
}
