"use client";

import { useEffect, useState } from "react";
import { useQueryState } from "@/hooks/useQueryState";
import EmptyState from "@/components/ui/EmptyState";
import { FOCUS_HOURS_PER_DAY, WORK_KINDS } from "@/constants/work";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import type { Pod, WorkEntry } from "@/types/work";
import { downloadWorkExcel } from "../exportWorkExcel";
import TaskHistoryModal from "./TaskHistoryModal";
import { carriedChain } from "./TaskSprintHours";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import { eachDay, formatDay, formatHours, isWeekend, percentOfTotal } from "../utils";
import { sprintLabel } from "@/constants/backlog-options";

type EveryoneViewProps = {
  /** The sprints being looked at (one or more). */
  sprints: (Sprint & { start: string; end: string })[];
  /** Entries in these sprints, from everyone. */
  entries: readonly WorkEntry[];
  /** Everyone who is expected to log time (owners, without "Unassigned"). */
  people: readonly string[];
  /** PODs of the chosen sprints that have tasks. */
  pods: readonly Pod[];
  /** Tasks in these sprints (including Unplanned while one runs). A person's assigned tasks are the ones that name them in Assignees. */
  tasks: readonly BacklogItemData[];
  /** Every task (also those of earlier sprints) and every logged entry, so a carried-over task can show its earlier sprints. */
  allTasks?: readonly BacklogItemData[];
  allEntries?: readonly WorkEntry[];
  /** When set, every breakdown and the summary cover only this person: their entries and the tasks assigned to them. */
  ownOnly?: string;
  /** The ids of the tasks the backend says are the person's (assigned to them or led by them), used with `ownOnly`. */
  ownTaskIds?: ReadonlySet<string>;
  /** Offers an Excel download of everyone's working details (the By person view). */
  exportable?: boolean;
  /** Every sprint, so the History view can follow a carried-over task. */
  allSprints?: readonly Sprint[];
  /** POD names by id, for the assigned tasks. */
  podNames: Readonly<Record<string, string>>;
  /** "Role · Team" text by person name, shown under their name. */
  details?: Readonly<Record<string, string>>;
  /** Planned hours for one person over all the sprints. */
  perPerson: number;
  /** Planned hours for one person over the whole of the sprints. */
  sprintTotal: number;
  updatedAt: Date | null;
  onRefresh: () => void;
};

type Breakdown = "person" | "pod" | "sprint";

const BREAKDOWNS: { id: Breakdown; label: string }[] = [
  { id: "person", label: "By person" },
  { id: "pod", label: "By POD" },
  { id: "sprint", label: "Across the sprint" },
];

const card = "rounded-2xl border border-border bg-surface p-5";
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

const sum = (list: readonly WorkEntry[]) => list.reduce((total, e) => total + e.hours, 0);

function Stat({ value, total, label, valueClass = "", totalClass = "text-muted" }: { value: string; total: string; label: string; valueClass?: string; totalClass?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p>
        <span className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</span>{" "}
        <span className={`text-sm tabular-nums ${totalClass}`}>/ {total}</span>
      </p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

/** Team-wide view for the "Everyone" tab: who has logged time, where it went, and how it spreads over the sprint. */
export default function EveryoneView({ sprints, entries: teamEntries, people: teamPeople, pods, tasks: teamTasks, allTasks = [], allEntries: teamAllEntries = [], allSprints = [], ownOnly, ownTaskIds, exportable = false, podNames, details = {}, perPerson, sprintTotal, updatedAt, onRefresh }: EveryoneViewProps) {
  const colorOf = makeTaskColor(allTasks, allSprints);
  const [breakdown, setBreakdown] = useQueryState<Breakdown>("by", ["person", "pod", "sprint"], "person");
  const [downloading, setDownloading] = useState(false);
  const allUsers = useUsers();
  // For anyone but a Super Admin or enabled Admin: only their own entries and assigned tasks, in every breakdown and the summary.
  const mine = ownOnly;
  // Their tasks: those the backend lists as theirs or that name them, and any they logged time on.
  const named = (t: BacklogItemData) => !!ownTaskIds?.has(t.id) || (mine !== undefined && assigneeKeys(t.assignees).includes(mine.toLowerCase()));
  const loggedOn = new Set(mine === undefined ? [] : teamEntries.filter((e) => e.person === mine).flatMap((e) => e.itemIds ?? []));
  const tasks = mine === undefined ? teamTasks : teamTasks.filter((t) => named(t) || loggedOn.has(t.id));
  // On those tasks (and only those) everyone's logged hours show, so the people who worked on the same task are visible; other tasks stay out of view.
  const mineTaskIds = new Set(tasks.map((t) => t.id));
  const onMine = (e: WorkEntry) => e.person === mine || !!e.itemIds?.some((id) => mineTaskIds.has(id));
  const entries = mine === undefined ? teamEntries : teamEntries.filter(onMine);
  const allEntries = mine === undefined ? teamAllEntries : teamAllEntries.filter(onMine);
  const people = mine === undefined ? teamPeople : [mine];

  const logged = sum(entries);
  // Everyone who logged time, even if they are no longer in the owner list.
  const everyPerson = [...new Set([...people, ...entries.map((e) => e.person)])];
  const capacity = perPerson * everyPerson.length;
  const filledIn = new Set(entries.map((e) => e.person));
  const podsUsed = new Set(entries.map((e) => e.podId ?? e.pod));

  return (
    <div className="flex flex-col gap-5">
      <p className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right text-xs text-muted">
        {exportable && breakdown === "person" && (
          <button
            type="button"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadWorkExcel({ people: everyPerson, entries, sprints, teams: Object.fromEntries(allUsers.map((u) => [u.name, u.team ?? ""])), expectedSoFar: perPerson, sprintTotal });
              } finally {
                setDownloading(false);
              }
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {downloading ? "Preparing…" : "Download Excel"}
          </button>
        )}
        <span>
        {updatedAt && <>updated {timeFormat.format(updatedAt)} · </>}
        <button type="button" onClick={onRefresh} className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          refresh
        </button>
        </span>
      </p>

      <section aria-label="Team summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat value={String(filledIn.size)} total={String(everyPerson.length)} label="people have filled in" />
        <Stat
          value={formatHours(logged)}
          total={`${formatHours(capacity)} expected so far · ${formatHours(sprintTotal * everyPerson.length)} total sprint hours`}
          label="logged so far"
          // Worked hours: blue up to the expected hours, orange beyond them.
          valueClass={capacity > 0 && logged > capacity ? "text-orange-600 dark:text-orange-300" : "text-blue-600 dark:text-blue-300"}
        />
        <Stat value={String(podsUsed.size)} total={String(pods.length)} label="PODs with time against them" />
      </section>

      <ul aria-label="Hours by kind of work" className="flex flex-wrap gap-2">
        {[...WORK_KINDS, ...new Set(entries.map((e) => e.kind).filter((k) => !WORK_KINDS.includes(k)))].map((k) => (
          <li key={k} className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
            <span className="rounded border px-1.5 font-mono text-[10px]" style={{ color: KIND_COLORS[k] ?? colorFor(k), borderColor: KIND_COLORS[k] ?? colorFor(k) }}>
              {k}
            </span>
            <span className="font-mono font-semibold tabular-nums">{formatHours(sum(entries.filter((e) => e.kind === k)))}</span>
          </li>
        ))}
      </ul>

      <div role="group" aria-label="Breakdown" className="grid grid-cols-3 rounded-xl border border-border bg-surface p-1">
        {BREAKDOWNS.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={breakdown === b.id}
            onClick={() => setBreakdown(b.id)}
            className={`rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              breakdown === b.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <section className={card} aria-label={BREAKDOWNS.find((b) => b.id === breakdown)?.label}>
        {breakdown === "person" && <ByPerson people={everyPerson} entries={entries} tasks={tasks} allTasks={allTasks} colorOf={colorOf} podNames={podNames} perPerson={perPerson} sprintTotal={sprintTotal} details={details} />}
        {breakdown === "pod" && <ByPod sprints={sprints} pods={pods} entries={entries} tasks={tasks} allTasks={allTasks} colorOf={colorOf} allEntries={allEntries} allSprints={allSprints} people={everyPerson} own={mine !== undefined} />}
        {breakdown === "sprint" && <AcrossSprint sprints={sprints} entries={entries} people={everyPerson} />}
      </section>
    </div>
  );
}

/** Data colours for tasks / PODs (squares and bar segments). */
const PALETTE = ["#5fcf8e", "#e0875f", "#e6d35a", "#a56cdc", "#5aa0e6", "#e6558a", "#4ad0c0", "#8fdc57", "#e0605a", "#8a94ab"];
const colorFor = (key: string) => {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
// Task colours: every sprint has its own colour family (blue, orange, green, ...) and each task of a sprint takes one shade
// of it, by its place among that sprint's tasks. So a task keeps one colour wherever it shows, tasks of one sprint are told
// apart by shade, and tasks of different sprints by colour. Unplanned tasks use a grey family.
const SPRINT_FAMILIES = [
  ["#2563eb", "#60a5fa", "#1e40af", "#38bdf8", "#1d4ed8", "#93c5fd"], // blue
  ["#ea580c", "#fb923c", "#9a3412", "#f59e0b", "#c2410c", "#fdba74"], // orange
  ["#16a34a", "#4ade80", "#166534", "#84cc16", "#15803d", "#86efac"], // green
  ["#7c3aed", "#a78bfa", "#5b21b6", "#c084fc", "#6d28d9", "#c4b5fd"], // purple
  ["#db2777", "#f472b6", "#9d174d", "#fb7185", "#be185d", "#f9a8d4"], // pink
  ["#0d9488", "#2dd4bf", "#115e59", "#22d3ee", "#0f766e", "#5eead4"], // teal
];
const UNPLANNED_SHADES = ["#64748b", "#94a3b8", "#475569", "#cbd5e1", "#334155", "#a8b4c4"];

function makeTaskColor(allTasks: readonly BacklogItemData[], allSprints: readonly Sprint[]): (taskId: string) => string {
  const sprintNames = allSprints.filter((s) => s.name !== "Unplanned").map((s) => s.name);
  const idsBySprint = new Map<string, string[]>();
  for (const t of allTasks) idsBySprint.set(t.sprint, [...(idsBySprint.get(t.sprint) ?? []), t.id]);
  for (const ids of idsBySprint.values()) ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return (taskId) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return "#8a94ab";
    const place = Math.max(0, idsBySprint.get(task.sprint)?.indexOf(taskId) ?? 0);
    const shades = task.sprint === "Unplanned" ? UNPLANNED_SHADES : SPRINT_FAMILIES[Math.max(0, sprintNames.indexOf(task.sprint)) % SPRINT_FAMILIES.length];
    return shades[place % shades.length];
  };
}
const KIND_COLORS: Record<string, string> = { Backend: "#4a8fe0", Frontend: "#ff6b6b", Mobile: "#f5a524", Testing: "#5fcf8e", Design: "#a78bfa" };
const GREEN = "#5fcf8e";
const RED = "#ff5c52";
const BLUE = "#4a8fe0";
const AMBER = "#f5a524";

const assigneeKeys = (value?: string) => (value ?? "").split(",").map((n) => n.trim().replace(/^@+/, "").trim().toLowerCase()).filter(Boolean);

/** Anyone who sees only their own work reads the Unplanned section as "Unassigned Tasks". */
const unplannedAs = (name: string, own: boolean) => (own && name === "Unplanned" ? "Unassigned Tasks" : name);

function ByPerson({
  people,
  entries,
  tasks,
  allTasks,
  colorOf,
  podNames,
  perPerson,
  sprintTotal,
  details,
}: {
  people: string[];
  entries: readonly WorkEntry[];
  tasks: readonly BacklogItemData[];
  allTasks: readonly BacklogItemData[];
  colorOf: (taskId: string) => string;
  podNames: Readonly<Record<string, string>>;
  perPerson: number;
  sprintTotal: number;
  details: Readonly<Record<string, string>>;
}) {
  if (people.length === 0) {
    return <EmptyState compact title="No people yet" description="Add team members on the Team Members page; they show up here with their assigned work." />;
  }
  // One colour per task (from its sprint's colour family), the same under every person.
  const taskColor = (id: string) => (id.startsWith("e:") ? "#8a94ab" : colorOf(id));
  const titleOf = (id: string, fallback: string) => allTasks.find((t) => t.id === id)?.title ?? tasks.find((t) => t.id === id)?.title ?? fallback;

  const rows = people
    .map((name) => {
      const list = entries.filter((e) => e.person === name);
      // Assigned tasks that no logged entry covers yet.
      const logged = new Set(list.flatMap((e) => e.itemIds ?? []));
      const assigned = tasks.filter((t) => assigneeKeys(t.assignees).includes(name.toLowerCase()) && !logged.has(t.id));
      return { name, list, assigned };
    })
    .sort((a, b) => sum(b.list) - sum(a.list) || a.name.localeCompare(b.name));
  // People with nothing logged and nothing assigned are listed apart, one short line each, in a block that scrolls on its own.
  const idle = rows.filter((r) => r.list.length + r.assigned.length === 0);
  const active = rows.filter((r) => r.list.length + r.assigned.length > 0);

  return (
    <>
    {/* People with logged work on the left; people with none in their own panel on the right (stacked on small screens), so the two never mix. */}
    <div className={idle.length > 0 && active.length > 0 ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start" : ""}>
    <ul className="min-w-0 divide-y divide-border">
      {active.map(({ name, list, assigned }) => {
        const total = sum(list);
        const pct = perPerson > 0 ? total / perPerson : 0;
        // Over the plan: red. Close to it: green. Under it: amber.
        const tone = list.length === 0 ? undefined : pct > 1.0005 ? RED : pct >= 0.9 ? GREEN : AMBER;
        const scale = Math.max(perPerson, total);
        const sorted = [...list].sort((x, y) => x.from.localeCompare(y.from));
        // This person's hours per task. An entry that covers several tasks has no split on the backend, so its hours are
        // shared equally between them (the person's total stays exactly what they logged).
        const perTask = new Map<string, { title: string; hours: number; notes: string[] }>();
        for (const en of sorted) {
          const ids = en.itemIds?.length ? en.itemIds : [`e:${en.id}`];
          for (const id of ids) {
            const row = perTask.get(id) ?? { title: titleOf(id, en.task), hours: 0, notes: [] };
            row.hours += en.hours / ids.length;
            if (en.notes && !row.notes.includes(en.notes)) row.notes.push(en.notes);
            perTask.set(id, row);
          }
        }
        const taskRows = [...perTask].map(([id, r]) => ({ id, ...r })).sort((x, y) => y.hours - x.hours);
        return (
          <li key={name} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm">
                <span className="font-semibold" style={{ color: tone }}>{name}</span>{" "}
                <span className="text-xs text-muted">
                  {[details[name], list.length ? `${list.length} ${list.length === 1 ? "entry" : "entries"}` : ""].filter(Boolean).join(" · ")}
                </span>
              </p>
              <p className="shrink-0 text-xs tabular-nums text-muted">
                {list.length ? (
                  <>
                    <span className="text-sm font-semibold" style={{ color: tone }}>{formatHours(total)}</span> of {formatHours(perPerson)} expected so far · {formatHours(sprintTotal)} total · {percentOfTotal(total, sprintTotal)}%
                  </>
                ) : assigned.length ? (
                  "not logged yet"
                ) : (
                  "No work logged yet"
                )}
              </p>
            </div>
            {/* A person with nothing logged and nothing assigned is one compact line: no empty bar, no box. */}
            {list.length + assigned.length > 0 && (
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
              {taskRows.map((r) => (
                <span key={r.id} className="h-full border-r border-surface last:border-r-0" title={`${r.title}: ${formatHours(r.hours)}`} style={{ width: `${scale > 0 ? (r.hours / scale) * 100 : 0}%`, background: taskColor(r.id) }} />
              ))}
            </div>
            )}
            {list.length + assigned.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-xs">
                {taskRows.map((r) => (
                  <li key={r.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: taskColor(r.id) }} aria-hidden="true" />
                        <span className="truncate">{r.title}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{formatHours(r.hours)}</span>
                    </div>
                    {r.notes.length > 0 && <p className="truncate pl-3.5 text-[11px] text-muted">{r.notes.join(" · ")}</p>}
                  </li>
                ))}
                {assigned.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-3 text-muted">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-sm bg-hover" aria-hidden="true" />
                      <span className="truncate">
                        {t.title} · {t.podId ? (podNames[t.podId] ?? "POD") : "Backlog"} · {sprintLabel(t.sprint)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px]">assigned</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
    {idle.length > 0 && (
      <section aria-label="No work logged yet" className="rounded-xl border border-border bg-background/60 p-3">
        <p className="text-center text-sm font-semibold">No work logged yet</p>
        <p className="mt-0.5 text-center text-xs text-muted">
          {idle.length} {idle.length === 1 ? "person" : "people"}
        </p>
        {/* About 5 names are visible; the rest scroll inside this panel. The right padding keeps the scrollbar clear of the names. */}
        <ul className="mt-2 max-h-40 divide-y divide-border overflow-y-auto pr-2">
          {idle.map(({ name }) => (
            <li key={name} className="flex items-baseline justify-between gap-3 py-1 text-sm">
              <span className="min-w-0 truncate font-semibold">{name}</span>
              <span className="shrink-0 text-xs text-muted">{details[name]}</span>
            </li>
          ))}
        </ul>
      </section>
    )}
    </div>
    <p className="mt-3 text-[11px] text-muted">Each colour is one task, the same under every person. Time logged on several tasks at once is shared equally between them.</p>
    </>
  );
}

type HistoryRow = { id: string; sprint: string; title: string; status: string; hours: number; by: { name: string; hours: number }[] };
type PodBlock = { key: string; name: string; hours: number; tasks: BacklogItemData[]; entries: WorkEntry[]; people: { name: string; hours: number; lines: string[]; assigned: boolean }[]; history: HistoryRow[] };

/** Each sprint with its PODs; under a POD, every person with their hours and tasks. PODs with nothing in them are left out. */
function ByPod({
  sprints,
  pods,
  entries,
  tasks,
  allTasks,
  colorOf,
  allEntries,
  allSprints,
  people,
  own = false,
}: {
  own?: boolean;
  sprints: (Sprint & { start: string; end: string })[];
  pods: readonly Pod[];
  entries: readonly WorkEntry[];
  tasks: readonly BacklogItemData[];
  allTasks: readonly BacklogItemData[];
  colorOf: (taskId: string) => string;
  allEntries: readonly WorkEntry[];
  allSprints: readonly Sprint[];
  people: readonly string[];
}) {
  // The task whose History view is open.
  const [viewing, setViewing] = useState<BacklogItemData | null>(null);
  // Tasks are listed by the hours logged on them in the selected sprint, most first; equal hours (and tasks with none) keep
  // their existing order, so tasks without logged work come last. Each entry is counted once.
  const taskHours = (task: BacklogItemData, sprint: Sprint) =>
    [...new Map(entries.filter((e) => e.itemIds?.includes(task.id) && (task.sprint === "Unplanned" || e.sprintId === sprint.id)).map((e) => [e.id, e])).values()].reduce((sum, e) => sum + e.hours, 0);

  const display = (token: string) => people.find((p) => p.toLowerCase() === token) ?? token;

  function block(key: string, name: string, podEntries: readonly WorkEntry[], podTasks: readonly BacklogItemData[]): PodBlock | null {
    if (podEntries.length === 0 && podTasks.length === 0) return null;
    const byPerson = new Map<string, { hours: number; lines: string[]; assigned: boolean }>();
    const row = (who: string) => byPerson.get(who) ?? byPerson.set(who, { hours: 0, lines: [], assigned: false }).get(who)!;
    for (const e of podEntries) {
      const r = row(e.person);
      r.hours += e.hours;
      r.lines.push(e.task);
    }
    for (const t of podTasks) {
      // Someone who sees only their own work still sees a task's people on its card, but only they appear in the hours rows.
      const names = assigneeKeys(t.assignees).map(display);
      if (own && names.length === 0) continue; // a task of one's own with nobody assigned: no placeholder row
      for (const who of names.length ? names : ["Unassigned"]) {
        const covered = entries.some((e) => e.person === who && e.itemIds?.includes(t.id));
        if (covered) continue;
        const r = row(who);
        r.assigned = true;
        r.lines.push(t.title);
      }
    }
    const rows = [...byPerson].map(([who, r]) => ({ name: who, ...r })).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));

    // Earlier sprints of the tasks here: a task that was carried over keeps its old record (and hours) in the sprint it left.
    const history: HistoryRow[] = [];
    const seenOrigins = new Set<string>();
    for (const t of podTasks) {
      let from = t.carriedFrom;
      for (let hops = 0; from && hops < 20; hops += 1) {
        const origin = allTasks.find((x) => x.id === from);
        if (!origin || seenOrigins.has(origin.id)) break;
        seenOrigins.add(origin.id);
        const logs = allEntries.filter((e) => e.itemIds?.includes(origin.id));
        const perName = new Map<string, number>();
        for (const l of logs) perName.set(l.person, (perName.get(l.person) ?? 0) + l.hours);
        history.push({
          id: origin.id,
          sprint: origin.sprint,
          title: origin.title,
          status: origin.status,
          hours: sum(logs),
          by: [...perName].map(([n, h]) => ({ name: n, hours: h })),
        });
        from = origin.carriedFrom;
      }
    }
    return { key, name, hours: sum(podEntries), tasks: [...podTasks], entries: [...podEntries], people: rows, history };
  }

  const sections = sprints.map((sprint) => {
    const blocks = (sprint.podIds ?? [])
      .flatMap((id) => pods.filter((p) => p.id === id))
      .map((pod) =>
        block(
          pod.id,
          pod.name,
          entries.filter((e) => e.sprintId === sprint.id && e.podId === pod.id),
          tasks.filter((t) => t.sprint === sprint.name && t.podId === pod.id),
        ),
      );
    // Tasks planned into the sprint without a POD.
    const noPodTasks = tasks.filter((t) => t.sprint === sprint.name && !t.podId);
    const noPodIds = new Set(noPodTasks.map((t) => t.id));
    const noPodEntries = entries.filter((e) => e.sprintId === sprint.id && !e.podId);
    const sprintEntries = noPodEntries.filter((e) => e.itemIds?.some((id) => noPodIds.has(id)));
    blocks.push(block("sprint-tasks", "Sprint tasks", sprintEntries, noPodTasks));
    return { sprint, blocks: blocks.filter((b): b is PodBlock => b !== null) };
  });

  if (sprints.length === 0) return <EmptyState compact title="No sprint selected" description="Pick a sprint above to see its PODs." />;

  return (
    <div className="flex flex-col gap-6">
      {sections.map(({ sprint, blocks }) => {
        const max = Math.max(...blocks.map((b) => b.hours), 0);
        return (
          <section key={sprint.id} aria-label={sprint.name}>
            {/* The sprint picker at the top says which sprint this is; the name is shown only to tell several apart. */}
            {sprints.length > 1 && (
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
              {unplannedAs(sprint.name, own)}
              <span className="text-xs font-normal text-muted">
                {formatDay(sprint.start)} – {formatDay(sprint.end)}
              </span>
              </h3>
            )}
            {blocks.length === 0 ? (
              <EmptyState compact title="No POD data" description="PODs show here once they have tasks or logged time." />
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {blocks.map((b) => {
                  const logged = b.people.filter((p) => p.hours > 0);
                  const color = colorFor(b.key);
                  if (b.key === "unplanned") return <UnplannedCard key={b.key} block={b} max={max} allTasks={allTasks} onView={setViewing} taskHours={(t) => taskHours(t, sprint)} />;
                  return (
                    // Every card has the same minimum height; its list scrolls inside, under the header.
                    <li key={b.key} className="flex min-h-[13rem] flex-col rounded-xl border border-border bg-background/60 p-3">
                      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="flex min-w-0 items-baseline gap-2 text-sm">
                          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />
                          {b.key !== "sprint-tasks" && <span className="truncate font-semibold">{unplannedAs(b.name, own)}</span>}
                          <span className="shrink-0 text-xs text-muted">
                            {logged.length} of {b.people.length} {b.people.length === 1 ? "person has" : "people have"} logged
                          </span>
                        </p>
                        <span className="shrink-0 font-mono text-sm font-semibold">{b.hours > 0 || own ? formatHours(b.hours) : "–"}</span>
                      </div>
                      {/* One header per task (name, Lead, Assigned Users, its own hours per sprint, View); the list scrolls under the card header. */}
                      <ul className="mt-2 max-h-[20.5rem] min-h-0 flex-1 divide-y divide-border overflow-y-auto pr-1">
                        {(() => {
                          // Highest hours first (ties and tasks without hours keep their order); each task's own bar is
                          // its hours against the busiest task of this card.
                          const rows = b.tasks.map((t) => ({ t, h: taskHours(t, sprint) })).sort((x, y) => y.h - x.h);
                          const top = rows.reduce((m, r) => Math.max(m, r.h), 0);
                          return rows.map(({ t, h }) => (
                          <PodTask
                            key={t.id}
                            task={t}
                            hours={h}
                            top={top}
                            color={colorOf(t.id)}
                            sprint={sprint}
                            entries={entries}
                            allTasks={allTasks}
                            allEntries={allEntries}
                            own={own}
                            onView={() => setViewing(t)}
                          />
                          ));
                        })()}
                        {b.tasks.length === 0 && <li className="py-2 text-xs text-muted">No tasks in this card.</li>}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {viewing && <TaskHistoryModal key={viewing.id} item={viewing} allTasks={allTasks} allSprints={allSprints} allEntries={allEntries} onlyMine onClose={() => setViewing(null)} />}
    </div>
  );
}

/**
 * Unplanned tasks, kept apart from the PODs: one card with one shared bar, how many people logged time and the total, then one line per
 * piece of logged work ("Person · task" and its hours), each with a View link to the task's history.
 */
function UnplannedCard({ block, max, allTasks, onView, taskHours }: { block: PodBlock; max: number; allTasks: readonly BacklogItemData[]; onView: (task: BacklogItemData) => void; taskHours: (task: BacklogItemData) => number }) {
  const lines = [...new Map(block.entries.map((e) => [e.id, e])).values()].sort((a, b) => b.hours - a.hours || a.person.localeCompare(b.person));
  // The lines of the task with the most hours come first (each task's total, from all its entries); ties keep the order above.
  const totalOf = (e: WorkEntry) => {
    const task = allTasks.find((t) => t.id === e.itemIds?.[0]);
    return task ? taskHours(task) : 0;
  };
  lines.sort((a, b) => totalOf(b) - totalOf(a));
  const people = new Set(lines.map((e) => e.person)).size;
  return (
    <li className="flex min-h-[13rem] flex-col rounded-xl border border-border bg-background/60 p-3">
      <div className="flex shrink-0 items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: colorFor(block.key) }} aria-hidden="true" />
          <span className="truncate font-semibold">Backlog</span>
          <span className="shrink-0 text-xs text-muted">
            {people} {people === 1 ? "person" : "people"}
          </span>
        </p>
        <span className="shrink-0 font-mono text-sm font-semibold">{block.hours > 0 ? formatHours(block.hours) : "–"}</span>
      </div>
      {/* One bar for all unplanned tasks together: their combined hours against the busiest card of the sprint. */}
      <div className="mt-1 h-1.5 shrink-0 overflow-hidden rounded-full bg-hover" role="img" aria-label={`${formatHours(block.hours)} logged on Backlog tasks`}>
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? (block.hours / max) * 100 : 0}%`, background: colorFor(block.key) }} />
      </div>
      {lines.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No time logged on Backlog tasks yet.</p>
      ) : (
        <ul className="mt-2 max-h-[20.5rem] min-h-0 flex-1 divide-y divide-border overflow-y-auto pr-1 text-xs">
          {lines.map((e) => {
            const task = allTasks.find((t) => t.id === e.itemIds?.[0]);
            return (
              <li key={e.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 break-words">
                  {e.person} · {e.task}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {task && (
                    <button
                      type="button"
                      onClick={() => onView(task)}
                      aria-label={`View ${task.title}`}
                      className="text-[11px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      View
                    </button>
                  )}
                  <span className="font-mono text-[11px] text-muted">{formatHours(e.hours)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/** One task inside a POD card: its name, Lead and Assigned Users, hours per sprint, and who logged time on it. */
function PodTask({
  task,
  hours,
  top,
  color,
  sprint,
  entries,
  allTasks,
  allEntries,
  own = false,
  onView,
}: {
  task: BacklogItemData;
  /** Hours logged on this task in the selected sprint, and the most hours on any task of the card (the bar's scale). */
  hours: number;
  top: number;
  color: string;
  sprint: Sprint;
  entries: readonly WorkEntry[];
  allTasks: readonly BacklogItemData[];
  allEntries: readonly WorkEntry[];
  own?: boolean;
  onView: () => void;
}) {
  const users = useUsers();
  // The list of tasks may leave out the Lead and the assignees; the task's own detail (`/items/:id`) then fills them in.
  const missing = !task.lead && !task.leadId && !task.assignees && !task.assigneeIds?.length;
  const [detail, setDetail] = useState<BacklogItemData | null>(null);
  useEffect(() => {
    if (!missing) return;
    let cancelled = false;
    useItemDetailStore.getState().get(task.id).then((d) => !cancelled && setDetail(d), () => {});
    return () => {
      cancelled = true;
    };
  }, [missing, task.id]);
  const people = missing && detail ? detail : task;
  // Lead and Assigned Users are matched by user id (names only when the backend gave no ids).
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name;
  const lead = (people.leadId ? nameOf(people.leadId) : undefined) ?? people.lead ?? "";
  const assigned = people.assigneeIds?.length
    ? people.assigneeIds.map((id) => nameOf(id)).filter((n): n is string => !!n)
    : (people.assignees ?? "").split(",").map((n) => n.trim().replace(/^@+/, "").trim()).filter(Boolean);

  // Hours per sprint for this task (everyone's, each entry once), oldest sprint first, then the total.
  const unique = [...new Map(allEntries.map((e) => [e.id, e])).values()];
  const records = [...carriedChain(task, allTasks)].reverse().concat(task);
  const parts = records.map((r) => ({ name: r.sprint, hours: sum(unique.filter((e) => e.itemIds?.includes(r.id))) }));
  const total = parts.reduce((s, p) => s + p.hours, 0);

  // Who logged time on it in the sprint being looked at.
  const mine = [...new Map(entries.filter((e) => e.itemIds?.includes(task.id) && (task.sprint === "Unplanned" || e.sprintId === sprint.id)).map((e) => [e.id, e])).values()];
  const byPerson = [...mine.reduce((m, e) => m.set(e.person, (m.get(e.person) ?? 0) + e.hours), new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const split = byPerson.length > 1;
  const waiting = assigned.filter((n) => !byPerson.some(([p]) => p.toLowerCase() === n.toLowerCase()));

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      {/* Task name (View at its end), then this task's own bar, then Lead and Assigned Users with the work hours at the end of each line. */}
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />
          <span className="truncate">{task.title}</span>
        </p>
        <button
          type="button"
          onClick={onView}
          aria-label={`View ${task.title}`}
          className="h-6 shrink-0 rounded-md border border-border px-2 text-[11px] font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          View
        </button>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover" role="img" aria-label={`${formatHours(hours)} logged in this sprint`}>
        {/* Several people logged on this task: one segment each, in the colour shown next to their name below. */}
        {split ? (
          <div className="flex h-full" style={{ width: `${top > 0 ? (hours / top) * 100 : 0}%` }}>
            {byPerson.map(([name, h], i) => (
              <span key={name} className="h-full border-r border-surface last:border-r-0" title={`${name}: ${formatHours(h)}`} style={{ width: `${hours > 0 ? (h / hours) * 100 : 0}%`, background: PALETTE[i % PALETTE.length] }} />
            ))}
          </div>
        ) : (
          <div className="h-full rounded-full" style={{ width: `${top > 0 ? (hours / top) * 100 : 0}%`, background: color }} />
        )}
      </div>
      {/* Hours per sprint (a carried-over task lists each sprint it was in), then the total. */}
      <p className="mt-1.5 flex flex-wrap items-baseline justify-end gap-x-3 text-[11px] text-muted">
        <span className="font-mono" title="Hours on this task, per sprint">
          {parts.map((p) => `${unplannedAs(p.name, own)}: ${formatHours(p.hours)}`).join(" | ")} = {formatHours(total)}
        </span>
      </p>
      <p className="text-right text-[11px] text-muted">
        <span className="font-mono font-semibold text-foreground">Total: {formatHours(total)}</span>
      </p>
      {(byPerson.length > 0 || waiting.length > 0) && (
        <ul className="mt-1.5 flex flex-col gap-0.5 text-xs">
          {byPerson.map(([name, hours], i) => (
            <li key={name} className="flex justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-1.5 truncate">
                {split && <span className="h-2 w-2 shrink-0 self-center rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden="true" />}
                {name}
                {lead && name.toLowerCase() === lead.toLowerCase() && <span className="ml-1.5 font-mono text-[10px] text-blue-500">lead</span>}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-muted">{formatHours(hours)}</span>
            </li>
          ))}
          {waiting.length > 0 && <li className="text-[11px] text-muted">Nothing yet from {waiting.join(", ")}</li>}
        </ul>
      )}
    </li>
  );
}

/** Day-by-day heat map per person: green about a full day, red over it, blue under it. */
function AcrossSprint({
  sprints,
  entries,
  people,
}: {
  sprints: (Sprint & { start: string; end: string })[];
  entries: readonly WorkEntry[];
  people: readonly string[];
}) {
  const days = [...new Set(sprints.flatMap((s) => eachDay(s.start, s.end)))].sort();
  if (entries.length === 0) {
    return <EmptyState compact title="Nothing logged yet" description="Hours appear here day by day once people start logging." />;
  }

  // Spread each entry's hours evenly over its working days (or all its days if it only spans a weekend), per person.
  const perPersonDay = new Map<string, Map<string, number>>();
  for (const e of entries) {
    const mine = perPersonDay.get(e.person) ?? perPersonDay.set(e.person, new Map()).get(e.person)!;
    const span = eachDay(e.from, e.to).filter((d) => days.includes(d));
    const working = span.filter((d) => !isWeekend(d));
    const target = working.length ? working : span;
    for (const d of target) mine.set(d, (mine.get(d) ?? 0) + e.hours / target.length);
  }
  const rows = people
    .filter((p) => perPersonDay.has(p))
    .map((name) => {
      const byDay = perPersonDay.get(name)!;
      return { name, byDay, total: [...byDay.values()].reduce((a, b) => a + b, 0) };
    });
  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(1.5rem, 1fr))` };
  const round = (h: number) => Math.round(h * 10) / 10;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${days.length * 2.25}rem` }}>
        <div className="grid gap-1 text-center text-[11px] tabular-nums text-muted" style={cols} aria-hidden="true">
          {days.map((d, i) => (
            <span key={d} className={isWeekend(d) ? "opacity-50" : undefined} title={formatDay(d)}>
              {i + 1}
            </span>
          ))}
        </div>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.name}>
              <p className="text-xs">
                <span className="font-semibold">{r.name}</span> <span className="text-muted">{formatHours(r.total)}</span>
              </p>
              <div className="mt-0.5 grid gap-1" style={cols}>
                {days.map((d) => {
                  const h = r.byDay.get(d) ?? 0;
                  const weekend = isWeekend(d);
                  if (weekend && h === 0) {
                    return <span key={d} className="h-5 rounded border border-dashed border-border" title={`${formatDay(d)}: weekend`} />;
                  }
                  if (h === 0) return <span key={d} className="h-5 rounded bg-hover/60" title={`${formatDay(d)}: nothing logged`} />;
                  const under = h < FOCUS_HOURS_PER_DAY - 0.5;
                  const color = h > FOCUS_HOURS_PER_DAY + 1 ? RED : under ? BLUE : GREEN;
                  return (
                    <span
                      key={d}
                      title={`${formatDay(d)}: ${formatHours(h)}`}
                      className="relative flex h-5 items-center justify-center overflow-hidden rounded bg-hover/60 font-mono text-[10px] font-semibold text-black"
                    >
                      {/* Under a full day: a bar that grows with the hours; otherwise a solid cell. */}
                      <span className="absolute inset-x-0 bottom-0" style={{ background: color, height: under ? `${Math.max(12, (h / FOCUS_HOURS_PER_DAY) * 100)}%` : "100%" }} />
                      <span className={`relative ${under ? "text-foreground" : ""}`}>{round(h)}</span>
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted">
        Hours per person per day, spread over each entry&apos;s working days. Green is about a full day ({formatHours(FOCUS_HOURS_PER_DAY)}), red is over, blue is under.
      </p>
    </div>
  );
}
