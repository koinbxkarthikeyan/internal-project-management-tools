import { STATUSES } from "@/constants/backlog-options";
import { addDays, eachDay, isWeekend, sprintHours } from "@/features/work/utils";
import type { ActivityEntry, BacklogItemData, Sprint, Status } from "@/types/backlog";
import type { WorkEntry } from "@/types/work";

/** The filters of the personal Overview. Empty strings mean "no limit" / "all". */
export type OverviewFilters = { from: string; to: string; sprintId: string; status: "" | Status };
export type DatedSprint = Sprint & { start: string; end: string };

/** A task sits at its completion date, else its expected deadline, else the day it was created. */
const taskDate = (t: BacklogItemData) => t.completed || t.deadline || t.created || "";
const inRange = (day: string, from: string, to: string) => !day || ((!from || day >= from) && (!to || day <= to));

/** Tasks by sprint, date range and status. A task with no date at all is kept (it can't be placed outside the range). */
export function filterTasks(tasks: readonly BacklogItemData[], f: OverviewFilters, sprints: readonly Sprint[]): BacklogItemData[] {
  const sprintName = f.sprintId ? sprints.find((s) => s.id === f.sprintId)?.name : undefined;
  return tasks.filter((t) => (!f.sprintId || t.sprint === sprintName) && (!f.status || t.status === f.status) && inRange(taskDate(t), f.from, f.to));
}

/** Work entries by sprint and date range (an entry counts when its dates touch the range); with a status, only entries on tasks of that status. */
export function filterEntries(entries: readonly WorkEntry[], tasks: readonly BacklogItemData[], f: OverviewFilters): WorkEntry[] {
  const withStatus = f.status ? new Set(tasks.filter((t) => t.status === f.status).map((t) => t.id)) : null;
  return entries.filter(
    (e) =>
      (!f.sprintId || e.sprintId === f.sprintId) &&
      (!f.from || !e.to || e.to >= f.from) &&
      (!f.to || !e.from || e.from <= f.to) &&
      (!withStatus || !!e.itemIds?.some((id) => withStatus.has(id))),
  );
}

export const sumHours = (entries: readonly WorkEntry[]) => entries.reduce((s, e) => s + e.hours, 0);

export function taskCounts(tasks: readonly BacklogItemData[], today: string) {
  const by = (s: Status) => tasks.filter((t) => t.status === s).length;
  const completed = by("Completed");
  return {
    total: tasks.length,
    completed,
    todo: by("Open"),
    inProgress: by("In progress"),
    overdue: tasks.filter((t) => t.status !== "Completed" && !!t.deadline && t.deadline < today).length,
    pending: tasks.length - completed,
    percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    byStatus: STATUSES.map((status) => ({ status, count: by(status) })),
  };
}

/** The sprint the analysis is about: the one picked in the filter, else the running one, else the one covering today, else the latest. */
export function focusSprint(sprints: readonly DatedSprint[], sprintId: string, today: string): DatedSprint | undefined {
  return (
    sprints.find((s) => s.id === sprintId) ??
    sprints.find((s) => s.status === "Active") ??
    sprints.find((s) => s.start <= today && today <= s.end) ??
    [...sprints].sort((a, b) => a.start.localeCompare(b.start)).at(-1)
  );
}

/** Planned, expected-so-far and remaining hours of one sprint against what the person logged in it; progress is the share of its working days gone by. */
export function sprintFigures(sprint: DatedSprint, entries: readonly WorkEntry[], tasks: readonly BacklogItemData[], today: string) {
  const { soFar, total } = sprintHours([sprint], today);
  const logged = sumHours(entries.filter((e) => e.sprintId === sprint.id));
  const inSprint = tasks.filter((t) => t.sprint === sprint.name);
  const done = inSprint.filter((t) => t.status === "Completed").length;
  return { total, soFar, logged, remaining: Math.max(0, total - logged), progress: total > 0 ? Math.round((soFar / total) * 100) : 0, done, pending: inSprint.length - done };
}

/** One entry's hours over its working days (a span with none puts them on its first day), so daily and weekly figures add up to what was logged. */
function spread(e: WorkEntry): [string, number][] {
  if (!e.from) return [];
  const days = eachDay(e.from, e.to || e.from).filter((d) => !isWeekend(d));
  const on = days.length ? days : [e.from];
  return on.map((d) => [d, e.hours / on.length]);
}

export function hoursByDay(entries: readonly WorkEntry[], days: readonly string[]) {
  const per = new Map<string, number>();
  for (const e of entries) for (const [d, h] of spread(e)) per.set(d, (per.get(d) ?? 0) + h);
  return days.map((day) => ({ day, hours: per.get(day) ?? 0 }));
}

/** The Monday of the week a day falls in. */
export function weekStart(iso: string) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}

/** Hours per week (Monday first) for the latest weeks that have any, oldest first. */
export function hoursByWeek(entries: readonly WorkEntry[], weeks = 8) {
  const per = new Map<string, number>();
  for (const e of entries) for (const [d, h] of spread(e)) per.set(weekStart(d), (per.get(weekStart(d)) ?? 0) + h);
  return [...per].sort(([a], [b]) => a.localeCompare(b)).slice(-weeks).map(([week, hours]) => ({ week, hours }));
}

/** The days the daily chart shows (weekdays only, at most the latest 14): the filtered range, else the focus sprint so far, else the last two weeks. */
export function chartDays(f: OverviewFilters, focus: DatedSprint | undefined, today: string): string[] {
  const end = f.to || (f.from ? today : focus ? (today < focus.end ? today : focus.end) : today);
  const start = f.from || (f.to || !focus ? addDays(end, -20) : focus.start);
  return eachDay(start > end ? end : start, end).filter((d) => !isWeekend(d)).slice(-14);
}

export type Activity = { at: string; kind: "Task assigned" | "Status changed" | "Work logged" | "Task completed" | "Task updated"; text: string; by?: string };

/** What a line of a task's own activity is about, read from its words (the backend sends free text). */
function kindOf(text: string): Activity["kind"] {
  if (/complet/i.test(text)) return "Task completed";
  if (/assign/i.test(text)) return "Task assigned";
  if (/status|moved to|changed .* to|blocked|on hold|in progress|reopen/i.test(text)) return "Status changed";
  return "Task updated";
}

/** The person's recent activity, newest first: their own logged work, their tasks' completions, and what happened on their tasks. */
export function buildActivity(entries: readonly WorkEntry[], tasks: readonly BacklogItemData[], details: Readonly<Record<string, readonly ActivityEntry[]>>, f: OverviewFilters, limit = 10): Activity[] {
  const out: Activity[] = [];
  for (const e of entries) if (e.createdAt) out.push({ at: e.createdAt, kind: "Work logged", text: `${e.hours}h on ${e.task || "other work"}` });
  for (const t of tasks) {
    if (t.status === "Completed" && t.completed) out.push({ at: t.completed, kind: "Task completed", text: t.title });
    for (const a of details[t.id] ?? []) out.push({ at: a.at ?? a.date, kind: kindOf(a.text), text: `${t.title}: ${a.text}`, ...(a.by ? { by: a.by } : {}) });
  }
  const seen = new Set<string>();
  return out
    .filter((a) => inRange(a.at.slice(0, 10), f.from, f.to))
    .filter((a) => !seen.has(`${a.kind}|${a.text}|${a.at}`) && seen.add(`${a.kind}|${a.text}|${a.at}`))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
