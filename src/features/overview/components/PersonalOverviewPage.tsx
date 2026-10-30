"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { SearchableSelect, controlClass } from "@/components/ui/FormControls";
import { STATUS_OPTIONS, sprintLabel } from "@/constants/backlog-options";
import { AFTER_LOGIN_KEY, WORK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatDeadline, todayISO } from "@/features/backlog/utils";
import { useChosenSprints } from "@/features/work/hooks/useChosenSprints";
import { useWorkData } from "@/features/work/hooks/useWorkData";
import { formatDay, formatHours } from "@/features/work/utils";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import { useMyTasksStore } from "@/stores/myTasksStore";
import type { ActivityEntry, Status } from "@/types/backlog";
import { buildActivity, chartDays, filterEntries, filterTasks, focusSprint, hoursByDay, hoursByWeek, sprintFigures, sumHours, taskCounts, type OverviewFilters } from "../stats";
import { ActivityList, BarChart, Panel, ProgressBar, RecentCompleted, RecentWork, StatCard, StatusChart } from "./OverviewPanels";

const EMPTY_FILTERS: OverviewFilters = { from: "", to: "", sprintId: "", status: "" };
const ALL = "all";

/**
 * The Overview for a Team Member (and a Disabled Admin): their own tasks, sprint, hours and activity, from the same backend data My Task
 * and Log Work use. Nothing about anyone else is read into it.
 */
export default function PersonalOverviewPage({ tabs }: { /** Shown in the page header (a Super Admin / Admin switching between Team and Personal). */ tabs?: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const { items, sprints } = useBacklog();
  const work = useWorkData();
  const mine = useMyTasksStore();
  const { datedSprints } = useChosenSprints();
  const [filters, setFilters] = useState<OverviewFilters>(EMPTY_FILTERS);
  const [details, setDetails] = useState<Record<string, ActivityEntry[]>>({});
  const today = todayISO();
  const meId = user?.id ?? "";
  const meName = user?.name.toLowerCase() ?? "";

  const { load: loadMine } = mine;
  useEffect(() => {
    if (meId) void loadMine(meId);
  }, [meId, loadMine]);

  // My tasks: the backend's My Task lists (assigned to me, or I lead) plus any task that names me, each as its newest copy.
  const myTasks = useMemo(() => {
    const listed = new Set(mine.scope === meId ? [...mine.buckets.lead, ...mine.buckets.assigned].map((t) => t.id) : []);
    return items.filter(
      (t) =>
        listed.has(t.id) ||
        (!!meId && (t.leadId === meId || !!t.assigneeIds?.includes(meId))) ||
        (!t.leadId && !!meName && t.lead?.toLowerCase() === meName) ||
        (!t.assigneeIds?.length && !!meName && (t.assignees ?? "").split(",").some((n) => n.trim().replace(/^@+/, "").toLowerCase() === meName)),
    );
  }, [items, mine.buckets, mine.scope, meId, meName]);
  const myEntries = useMemo(() => work.entries.filter((e) => (e.personId ? e.personId === meId : e.person === user?.name)), [work.entries, meId, user?.name]);

  const tasks = useMemo(() => filterTasks(myTasks, filters, sprints), [myTasks, filters, sprints]);
  const entries = useMemo(() => filterEntries(myEntries, myTasks, filters), [myEntries, myTasks, filters]);
  const counts = taskCounts(tasks, today);
  const logged = sumHours(entries);
  const focus = focusSprint(datedSprints, filters.sprintId, today);
  const sprint = focus ? sprintFigures(focus, entries, tasks, today) : null;

  // What happened on my most recently changed tasks (their own activity lists, read once per task and kept for a minute).
  const recent = useMemo(() => [...tasks].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 8), [tasks]);
  const recentKey = recent.map((t) => t.id).join(",");
  useEffect(() => {
    let cancelled = false;
    for (const t of recent) {
      useItemDetailStore.getState().get(t.id).then(
        (d) => !cancelled && setDetails((prev) => (prev[t.id] === d.activity ? prev : { ...prev, [t.id]: d.activity ?? [] })),
        () => undefined, // a task whose detail can't be read just adds no activity lines
      );
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentKey]);

  // Straight after signing in, someone who has logged no hours at all goes to the Log Work form instead (once; later visits stay here).
  const loaded = work.status === "ready" && mine.status !== "loading";
  const noHours = loaded && sumHours(myEntries) === 0;
  useEffect(() => {
    if (!loaded) return;
    try {
      if (sessionStorage.getItem(AFTER_LOGIN_KEY) === null) return;
      sessionStorage.removeItem(AFTER_LOGIN_KEY);
    } catch {
      return;
    }
    if (noHours) router.replace(WORK_HREF);
  }, [loaded, noHours, router]);

  if (work.status === "loading" || (mine.status === "loading" && myTasks.length === 0)) return <PageSkeleton />;
  if (work.status === "error" || mine.status === "error") {
    return (
      <section role="alert" className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border bg-surface p-5 text-center">
        <h2 className="text-base font-semibold">Couldn&apos;t load your overview</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">{work.error || mine.error}</p>
        <button
          type="button"
          onClick={() => (work.reload(), void loadMine(meId, true))}
          className="mt-4 rounded-xl btn-brand px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </section>
    );
  }

  const days = chartDays(filters, focus, today);
  const sprintName = (id: string) => sprints.find((s) => s.id === id)?.name ?? "Sprint";
  const perSprint = datedSprints.map((s) => ({ s, hours: sumHours(entries.filter((e) => e.sprintId === s.id)) })).filter((r) => r.hours > 0 || r.s.id === focus?.id);
  const recentWork = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.from.localeCompare(a.from)).slice(0, 5);
  const recentDone = tasks.filter((t) => t.status === "Completed").sort((a, b) => (b.completed ?? "").localeCompare(a.completed ?? "")).slice(0, 5);
  const activity = buildActivity(entries, tasks, details, filters);
  const filtered = filters.from !== "" || filters.to !== "" || filters.sprintId !== "" || filters.status !== "";
  const set = (patch: Partial<OverviewFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" description="Your tasks, sprint progress, hours and recent activity." actions={tabs} />

      <section aria-label="Filters" className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          From
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} className={`${controlClass} h-10`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          To
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} className={`${controlClass} h-10`} />
        </label>
        <SearchableSelect
          label="Sprint"
          value={filters.sprintId || ALL}
          onChange={(v) => set({ sprintId: v === ALL ? "" : v })}
          options={[{ value: ALL, label: "All sprints" }, ...datedSprints.map((s) => ({ value: s.id, label: sprintLabel(s.name) }))]}
        />
        <SearchableSelect
          label="Status"
          value={filters.status || ALL}
          onChange={(v) => set({ status: v === ALL ? "" : (v as Status) })}
          options={[{ value: ALL, label: "All statuses" }, ...STATUS_OPTIONS]}
        />
        <button
          type="button"
          disabled={!filtered}
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="h-10 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          Reset
        </button>
        <p className="text-xs text-muted sm:col-span-2 lg:col-span-full">The date range applies to task deadlines (the completion date for finished tasks) and to the dates of logged work.</p>
      </section>

      <section aria-label="Summary">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Assigned tasks" value={counts.total} hint="Assigned to you or led by you" />
          <StatCard label="Completed" value={counts.completed} tone="text-emerald-600 dark:text-emerald-300" />
          <StatCard label="In progress" value={counts.inProgress} tone="text-violet-600 dark:text-violet-300" />
          <StatCard label="To Do" value={counts.todo} tone="text-blue-600 dark:text-blue-300" />
          <StatCard label="Overdue" value={counts.overdue} tone={counts.overdue ? "text-red-600 dark:text-red-300" : undefined} hint="Past deadline, not completed" />
          <StatCard label="Logged hours" value={formatHours(logged)} />
          <StatCard label="Current sprint" value={focus ? sprintLabel(focus.name) : "None"} hint={focus ? `${formatDay(focus.start)} – ${formatDay(focus.end)}` : "No sprint is running"} />
          <StatCard label="Remaining sprint hours" value={sprint ? formatHours(sprint.remaining) : "–"} hint={sprint ? `of ${formatHours(sprint.total)} planned` : undefined} />
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tasks by status" note="Your tasks that match the filters.">
          <StatusChart byStatus={counts.byStatus} total={counts.total} />
        </Panel>

        <Panel title="Sprint analysis" note={focus ? `${sprintLabel(focus.name)} · ${formatDeadline(focus.start)} – ${formatDeadline(focus.end)}` : "No sprint to show."}>
          {sprint ? (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-muted">
                  <span>Sprint progress</span>
                  <span className="tabular-nums font-semibold text-foreground">{sprint.progress}%</span>
                </div>
                <ProgressBar percent={sprint.progress} label="Sprint progress" />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ["Planned hours", formatHours(sprint.total)],
                  ["Expected so far", formatHours(sprint.soFar)],
                  ["Logged", formatHours(sprint.logged)],
                  ["Remaining", formatHours(sprint.remaining)],
                  ["Tasks completed", String(sprint.done)],
                  ["Tasks pending", String(sprint.pending)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-border pb-1.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted">Create or start a sprint to see its progress here.</p>
          )}
        </Panel>

        <Panel title="Daily hours" note="Hours you logged per working day.">
          <BarChart label="Hours logged per day" bars={hoursByDay(entries, days).map((d) => ({ key: d.day, label: d.day.slice(8), title: `${formatDay(d.day)}: ${formatHours(d.hours)}`, value: d.hours }))} />
        </Panel>
        <Panel title="Weekly hours" note="Hours per week, Monday first.">
          <BarChart label="Hours logged per week" bars={hoursByWeek(entries).map((w) => ({ key: w.week, label: formatDay(w.week), title: `Week of ${formatDay(w.week)}: ${formatHours(w.hours)}`, value: w.hours }))} />
        </Panel>

        <Panel title="Hours by sprint">
          {perSprint.length === 0 ? (
            <p className="text-sm text-muted">No hours logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5 text-sm">
              {perSprint.map(({ s, hours }) => {
                const planned = sprintFigures(s, entries, [], today).total;
                return (
                  <li key={s.id} className="flex flex-col gap-1">
                    <span className="flex justify-between gap-3">
                      <span className="truncate">{sprintLabel(s.name)}</span>
                      <span className="shrink-0 tabular-nums text-muted"><span className="font-semibold text-foreground">{formatHours(hours)}</span> of {formatHours(planned)}</span>
                    </span>
                    <ProgressBar percent={planned > 0 ? (hours / planned) * 100 : 0} label={`${sprintLabel(s.name)} hours`} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Recent work logged">
          <RecentWork entries={recentWork} sprintName={sprintName} />
        </Panel>

        <Panel title="Task performance" note={`${counts.completed} of ${counts.total} completed · ${counts.pending} pending · ${counts.overdue} overdue`}>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted">
              <span>Completion</span>
              <span className="tabular-nums font-semibold text-foreground">{counts.percent}%</span>
            </div>
            <ProgressBar percent={counts.percent} label="Task completion" color="#5fcf8e" />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted">Recently completed</h3>
            <RecentCompleted tasks={recentDone} />
          </div>
        </Panel>
        <Panel title="My activity" note="Recent changes on your tasks and your logged work.">
          <ActivityList activity={activity} />
        </Panel>
      </div>
    </div>
  );
}
