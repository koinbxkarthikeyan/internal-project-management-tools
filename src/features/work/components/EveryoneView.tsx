"use client";

import { useQueryState } from "@/hooks/useQueryState";
import EmptyState from "@/components/ui/EmptyState";
import { FOCUS_HOURS_PER_DAY, WORK_KINDS } from "@/constants/work";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import type { Pod, WorkEntry } from "@/types/work";
import { eachDay, formatDay, formatHours, isWeekend } from "../utils";

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
  /** POD names by id, for the assigned tasks. */
  podNames: Readonly<Record<string, string>>;
  /** "Role · Team" text by person name, shown under their name. */
  details?: Readonly<Record<string, string>>;
  /** Planned hours for one person over all the sprints. */
  perPerson: number;
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
export default function EveryoneView({ sprints, entries, people, pods, tasks, podNames, details = {}, perPerson, updatedAt, onRefresh }: EveryoneViewProps) {
  const [breakdown, setBreakdown] = useQueryState<Breakdown>("by", ["person", "pod", "sprint"], "person");

  const logged = sum(entries);
  const capacity = perPerson * people.length;
  const filledIn = new Set(entries.map((e) => e.person));
  const podsUsed = new Set(entries.map((e) => e.podId ?? e.pod));

  // Everyone who logged time, even if they are no longer in the owner list.
  const everyPerson = [...new Set([...people, ...entries.map((e) => e.person)])];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-right text-xs text-muted">
        {updatedAt && <>updated {timeFormat.format(updatedAt)} · </>}
        <button type="button" onClick={onRefresh} className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          refresh
        </button>
      </p>

      <section aria-label="Team summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat value={String(filledIn.size)} total={String(people.length)} label="people have filled in" />
        <Stat
          value={formatHours(logged)}
          total={`${formatHours(capacity)} expected so far`}
          label="logged so far"
          // Worked hours: blue up to the expected hours, orange beyond them.
          valueClass={capacity > 0 && logged > capacity ? "text-orange-600 dark:text-orange-300" : "text-blue-600 dark:text-blue-300"}
        />
        <Stat value={String(podsUsed.size)} total={String(pods.length)} label="PODs with time against them" />
      </section>

      <ul aria-label="Hours by kind of work" className="flex flex-wrap gap-2">
        {WORK_KINDS.map((k) => (
          <li key={k} className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
            <span className="rounded border px-1.5 font-mono text-[10px]" style={{ color: KIND_COLORS[k], borderColor: KIND_COLORS[k] }}>
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
        {breakdown === "person" && <ByPerson people={everyPerson} entries={entries} tasks={tasks} podNames={podNames} perPerson={perPerson} details={details} />}
        {breakdown === "pod" && <ByPod sprints={sprints} pods={pods} entries={entries} tasks={tasks} people={everyPerson} />}
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
const KIND_COLORS: Record<string, string> = { Backend: "#4a8fe0", Frontend: "#ff6b6b", Mobile: "#f5a524", Testing: "#5fcf8e", Design: "#a78bfa" };
const GREEN = "#5fcf8e";
const RED = "#ff5c52";
const BLUE = "#4a8fe0";
const AMBER = "#f5a524";

const assigneeKeys = (value?: string) => (value ?? "").split(",").map((n) => n.trim().replace(/^@+/, "").trim().toLowerCase()).filter(Boolean);

function ByPerson({
  people,
  entries,
  tasks,
  podNames,
  perPerson,
  details,
}: {
  people: string[];
  entries: readonly WorkEntry[];
  tasks: readonly BacklogItemData[];
  podNames: Readonly<Record<string, string>>;
  perPerson: number;
  details: Readonly<Record<string, string>>;
}) {
  if (people.length === 0) {
    return <EmptyState compact title="No people yet" description="Add users on the Users page; they show up here with their assigned work." />;
  }
  const rows = people
    .map((name) => {
      const list = entries.filter((e) => e.person === name);
      // Assigned tasks that no logged entry covers yet.
      const logged = new Set(list.flatMap((e) => e.itemIds ?? []));
      const assigned = tasks.filter((t) => assigneeKeys(t.assignees).includes(name.toLowerCase()) && !logged.has(t.id));
      return { name, list, assigned };
    })
    .sort((a, b) => sum(b.list) - sum(a.list) || a.name.localeCompare(b.name));

  return (
    <ul className="divide-y divide-border">
      {rows.map(({ name, list, assigned }) => {
        const total = sum(list);
        const pct = perPerson > 0 ? total / perPerson : 0;
        // Over the plan: red. Close to it: green. Under it: amber.
        const tone = list.length === 0 ? undefined : pct > 1.0005 ? RED : pct >= 0.9 ? GREEN : AMBER;
        const scale = Math.max(perPerson, total);
        const sorted = [...list].sort((x, y) => x.from.localeCompare(y.from));
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
                    <span className="text-sm font-semibold" style={{ color: tone }}>{formatHours(total)}</span> of {formatHours(perPerson)} · {Math.round(pct * 100)}%
                  </>
                ) : assigned.length ? (
                  "not logged yet"
                ) : (
                  "hasn't filled in"
                )}
              </p>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
              {sorted.map((e) => (
                <span key={e.id} className="h-full" style={{ width: `${scale > 0 ? (e.hours / scale) * 100 : 0}%`, background: colorFor(e.podId ?? e.pod) }} />
              ))}
            </div>
            {list.length + assigned.length === 0 && (
              <EmptyState inline title="No sprint assigned" description="Assigned tasks and logged time will show here." />
            )}
            {list.length + assigned.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-xs">
                {sorted.map((e) => (
                  <li key={e.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: colorFor(e.podId ?? e.pod) }} aria-hidden="true" />
                        <span className="truncate">
                          {e.task} <span className="text-muted">· {e.pod}</span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">
                        {formatDay(e.from)}–{formatDay(e.to)} · {formatHours(e.hours)}
                      </span>
                    </div>
                    {e.notes && <p className="truncate pl-3.5 text-[11px] text-muted">{e.notes}</p>}
                  </li>
                ))}
                {assigned.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-3 text-muted">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-sm bg-hover" aria-hidden="true" />
                      <span className="truncate">
                        {t.title} · {t.podId ? (podNames[t.podId] ?? "POD") : "Unplanned"} · {t.sprint}
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
  );
}

type PodBlock = { key: string; name: string; hours: number; people: { name: string; hours: number; lines: string[]; assigned: boolean }[] };

/** Each sprint with its PODs; under a POD, every person with their hours and tasks. PODs with nothing in them are left out. */
function ByPod({
  sprints,
  pods,
  entries,
  tasks,
  people,
}: {
  sprints: (Sprint & { start: string; end: string })[];
  pods: readonly Pod[];
  entries: readonly WorkEntry[];
  tasks: readonly BacklogItemData[];
  people: readonly string[];
}) {
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
      const names = assigneeKeys(t.assignees).map(display);
      for (const who of names.length ? names : ["Unassigned"]) {
        const covered = entries.some((e) => e.person === who && e.itemIds?.includes(t.id));
        if (covered) continue;
        const r = row(who);
        r.assigned = true;
        r.lines.push(t.title);
      }
    }
    const rows = [...byPerson].map(([who, r]) => ({ name: who, ...r })).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
    return { key, name, hours: sum(podEntries), people: rows };
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
    // Unplanned work belongs to the running sprint.
    if (sprint.status === "Active") {
      blocks.push(block("unplanned", "Unplanned", noPodEntries.filter((e) => !sprintEntries.includes(e)), tasks.filter((t) => t.sprint === "Unplanned")));
    }
    return { sprint, blocks: blocks.filter((b): b is PodBlock => b !== null) };
  });

  if (sprints.length === 0) return <EmptyState compact title="No sprint selected" description="Pick a sprint above to see its PODs." />;

  return (
    <div className="flex flex-col gap-6">
      {sections.map(({ sprint, blocks }) => {
        const max = Math.max(...blocks.map((b) => b.hours), 0);
        return (
          <section key={sprint.id} aria-label={sprint.name}>
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
              {sprint.name}
              <span className="text-xs font-normal text-muted">
                {formatDay(sprint.start)} – {formatDay(sprint.end)}
              </span>
            </h3>
            {blocks.length === 0 ? (
              <EmptyState compact title="No POD data" description="PODs show here once they have tasks or logged time." />
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {blocks.map((b) => {
                  const logged = b.people.filter((p) => p.hours > 0);
                  const waiting = b.people.filter((p) => p.hours === 0).map((p) => p.name);
                  const color = colorFor(b.key);
                  return (
                    <li key={b.key} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="flex min-w-0 items-baseline gap-2 text-sm">
                          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />
                          <span className="truncate font-semibold">{b.name}</span>
                          <span className="shrink-0 text-xs text-muted">
                            {logged.length} of {b.people.length} {b.people.length === 1 ? "person has" : "people have"} logged
                          </span>
                        </p>
                        <span className="shrink-0 font-mono text-sm font-semibold">{b.hours > 0 ? formatHours(b.hours) : "–"}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${max > 0 ? (b.hours / max) * 100 : 0}%`, background: color }} />
                      </div>
                      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs">
                        {logged.map((p) => (
                          <li key={p.name}>
                            <div className="flex justify-between gap-3">
                              <span>{p.name}</span>
                              <span className="shrink-0 font-mono text-[11px] text-muted">{formatHours(p.hours)}</span>
                            </div>
                            <p className="truncate text-[11px] text-muted">{p.lines.join(" · ")}</p>
                          </li>
                        ))}
                        {waiting.length > 0 && (
                          <li className="text-[11px] text-muted">
                            Nothing yet from {waiting.join(", ")}
                            {b.people.filter((p) => p.hours === 0).some((p) => p.lines.length) && (
                              <span className="block truncate">{b.people.filter((p) => p.hours === 0).flatMap((p) => p.lines).join(" · ")}</span>
                            )}
                          </li>
                        )}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
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
