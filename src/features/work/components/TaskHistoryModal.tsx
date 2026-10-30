"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { formatActivityTime, formatDeadline, todayISO } from "@/features/backlog/utils";
import { newestFirst, whenOrUnavailable } from "@/features/backlog/components/ActivityTimeline";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useWorkStore } from "@/stores/workStore";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import type { ActivityEntry, BacklogItemData, Sprint } from "@/types/backlog";
import type { WorkEntry } from "@/types/work";
import { formatDay, formatHours, plannedHours } from "../utils";
import { sprintLabel } from "@/constants/backlog-options";

type TaskHistoryModalProps = {
  item: BacklogItemData;
  /** Every task (hidden too), every sprint and every logged entry, to follow the task from sprint to sprint. */
  allTasks: readonly BacklogItemData[];
  allSprints: readonly Sprint[];
  /** Left out on Sprint Plan: the modal then reads the shared work entries itself (loaded once, reused while fresh). */
  allEntries?: readonly WorkEntry[];
  /** Only the signed-in person's own work is shown (My Sprint): other people's entries are left out of every list and total. */
  onlyMine?: boolean;
};

const sum = (list: readonly WorkEntry[]) => list.reduce((total, e) => total + e.hours, 0);
const tag = "rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted";

/** A task's records over time: back to the sprint it was created in, then forward through every carry-over. */
function taskChain(item: BacklogItemData, all: readonly BacklogItemData[]): BacklogItemData[] {
  const byId = new Map(all.map((t) => [t.id, t]));
  let root = item;
  for (let i = 0; i < 50 && root.carriedFrom; i += 1) {
    const parent = byId.get(root.carriedFrom);
    if (!parent) break;
    root = parent;
  }
  const chain = [root];
  for (let i = 0; i < 50; i += 1) {
    const last = chain[chain.length - 1];
    const next = all.find((t) => t.carriedFrom === last.id);
    if (!next || chain.includes(next)) break;
    chain.push(next);
  }
  return chain;
}

/** "12 Oct 2026, 10:35 AM" when the entry's timestamp has a time, else just the date. */
const entryWhen = (e: WorkEntry) => formatActivityTime({ date: e.createdAt.slice(0, 10), ...(/T\d{2}:\d{2}/.test(e.createdAt) ? { at: e.createdAt } : {}) });

/**
 * Large read-only view of one task: its details, how it moved from sprint to sprint, and the work logged in each
 * sprint (per person, with hours and dates). Everything shown comes from the loaded tasks, sprints and work entries;
 * nothing is filled in when the data isn't there.
 */
export function TaskHistoryBody({ item, allTasks, allSprints, allEntries: given, onlyMine = false }: TaskHistoryModalProps) {
  const users = useUsers();
  const { user } = useAuth();
  const storeEntries = useWorkStore((s) => s.entries);
  const entriesLoading = useWorkStore((s) => s.status === "loading");
  const entriesFailed = useWorkStore((s) => s.status === "error");
  // "Mine" is decided by the user id of the session (the name only when an entry carries no id).
  const isMine = (e: WorkEntry) => (e.personId ? e.personId === user?.id : e.person === user?.name);
  const sourceEntries = given ?? storeEntries;
  const allEntries = useMemo(() => (onlyMine ? sourceEntries.filter(isMine) : sourceEntries), [onlyMine, sourceEntries, user?.id, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  // Without entries handed in, the shared ones are loaded now (a read only if they are missing or old).
  useEffect(() => {
    if (!given) useWorkStore.getState().load(user?.id ?? "").catch(() => undefined);
  }, [given, user?.id]);
  const [activity, setActivity] = useState<Record<string, ActivityEntry[]>>({});
  const today = todayISO();


  const chain = useMemo(() => taskChain(item, allTasks), [item, allTasks]);

  // The activity of each record comes from the task detail (`/items/:id`); a record that can't be read just has none.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(chain.map((t) => useItemDetailStore.getState().get(t.id))).then((results) => {
      if (cancelled) return;
      const next: Record<string, ActivityEntry[]> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.activity?.length) next[chain[i].id] = r.value.activity;
      });
      setActivity(next);
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  const teamOf = (name: string) => users.find((u) => u.name === name)?.team;
  /** "Name (Team · email)": what is known about a person, for Owner / Lead / Assignees. */
  const person = (name?: string) => {
    if (!name) return undefined;
    const u = users.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const extra = [u?.team, u?.email].filter(Boolean).join(" · ");
    return extra ? `${name} (${extra})` : name;
  };

  const records = chain.map((t, index) => {
    const sprint = allSprints.find((s) => s.name === t.sprint);
    const entries = allEntries.filter((e) => e.itemIds?.includes(t.id));
    return { task: t, sprint, entries, index };
  });
  // Count each work entry once, even if it were attached to more than one record.
  const unique = [...new Map(records.flatMap((r) => r.entries).map((e) => [e.id, e])).values()];
  const people = [...new Set(unique.map((e) => e.person))];
  // Which sprint each entry belongs to: the sprint of the task record it was logged against.
  const sprintOfEntry = new Map(records.flatMap((r) => r.entries.map((e) => [e.id, r.task.sprint] as const)));
  const perSprint = (mine: readonly WorkEntry[]) => {
    const totals = new Map<string, number>();
    for (const e of mine) totals.set(sprintOfEntry.get(e.id) ?? "?", (totals.get(sprintOfEntry.get(e.id) ?? "?") ?? 0) + e.hours);
    return [...totals].map(([name, h]) => `${name} ${formatHours(h)}`).join(" · ");
  };
  const link = (t: BacklogItemData) => {
    const from = t.carriedFrom ? allTasks.find((x) => x.id === t.carriedFrom) : undefined;
    return from ? `Carried over from ${sprintLabel(from.sprint)} (${from.status})` : "Created here";
  };

  return (
    <>
        <section aria-label="Task details" className="flex flex-col gap-3">
          {item.description && <p className="whitespace-pre-line break-words text-sm">{item.description}</p>}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {[
              ["Owner", person(item.owner)],
              ["Lead", person(item.lead)],
              ["Assignees", item.assignees ? item.assignees.split(",").map((n) => person(n.trim())).filter(Boolean).join("; ") : undefined],
              ["Type", item.type],
              ["Sprint", item.sprint],
              ["Expected deadline", item.deadline ? formatDeadline(item.deadline) : undefined],
              ["Lead Deadline", item.leadDeadline ? formatDeadline(item.leadDeadline) : undefined],
              ["Completed", item.completed ? formatDeadline(item.completed) : undefined],
              ["Created", whenOrUnavailable(item.created, item.createdAt)],
              ["Last updated", whenOrUnavailable(undefined, item.updatedAt)],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs font-medium text-muted">{k}</dt>
                  <dd className="mt-1 break-words">{v}</dd>
                </div>
              ))}
            <div>
              <dt className="text-xs font-medium text-muted">Status</dt>
              <dd className="mt-1"><StatusBadge status={item.status} /></dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Priority</dt>
              <dd className="mt-1"><PriorityBadge priority={item.priority} /></dd>
            </div>
          </dl>
          {item.notes && <p className="whitespace-pre-line break-words text-sm text-muted">{item.notes}</p>}
        </section>

        <section aria-label="Who worked on it" className="rounded-xl border border-border bg-background/60 p-4">
          <h3 className="text-sm font-semibold">{onlyMine ? "Your work" : "Contribution"}</h3>
          {entriesLoading && !given ? (
            <p className="mt-1 text-sm text-muted">Loading the logged time…</p>
          ) : entriesFailed && !given ? (
            <p className="mt-1 text-sm text-muted">The logged time couldn&apos;t be loaded, so hours aren&apos;t shown.</p>
          ) : people.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{onlyMine ? "You haven't logged any time against this task yet." : "No time has been logged against this task yet."}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                {people.length} {people.length === 1 ? "person" : "people"} · {formatHours(sum(unique))} in total · {unique.length} {unique.length === 1 ? "entry" : "entries"}
              </p>
              <ul className="mt-3 divide-y divide-border text-sm">
                {people.map((name) => {
                  const mine = unique.filter((e) => e.person === name);
                  return (
                    <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                      <span className="min-w-0">
                        <span className="font-medium">{name}</span>
                        {teamOf(name) && <span className="ml-2 text-xs text-muted">{teamOf(name)}</span>}
                      </span>
                      <span className="text-xs tabular-nums text-muted">
                        {perSprint(mine)} · {formatHours(sum(mine))} · {mine.length} {mine.length === 1 ? "entry" : "entries"} · {[...new Set(mine.flatMap((e) => [e.from, e.to]))].sort().map(formatDay).join(", ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section aria-label="Sprint timeline">
          <h3 className="text-sm font-semibold">Sprint timeline</h3>
          {chain.length === 1 && !item.carriedFrom && (
            <p className="mt-1 text-xs text-muted">This task has not been carried into another sprint.</p>
          )}
          <ol className="mt-3 flex flex-col gap-4 border-l border-border pl-4">
            {records.map(({ task, sprint, entries }) => {
              const expectedTo = sprint?.end && sprint.end < today ? sprint.end : today;
              const expected = sprint?.start && sprint.start <= expectedTo ? plannedHours(sprint.start, expectedTo) : 0;
              // The whole sprint's weekday hours for one person.
              const sprintTotal = sprint?.start && sprint.end ? plannedHours(sprint.start, sprint.end) : 0;
              const byPerson = [...new Set(entries.map((e) => e.person))];
              const log = activity[task.id] ?? task.activity ?? [];
              return (
                <li key={task.id} className="relative rounded-xl border border-border bg-background/60 p-4">
                  <span className="absolute -left-[1.4rem] top-5 h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h4 className="text-sm font-semibold">
                      {sprintLabel(task.sprint)}
                      {sprint?.start && sprint.end && (
                        <span className="ml-2 text-xs font-normal text-muted">
                          {formatDay(sprint.start)} – {formatDay(sprint.end)}
                          {sprint.status ? ` · ${sprint.status}` : ""}
                        </span>
                      )}
                    </h4>
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {link(task)}
                  </p>

                  <div className="mt-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs font-medium text-muted">
                      <span>Work logged</span>
                      <span className="tabular-nums">
                        {formatHours(sum(entries))} worked{expected > 0 ? ` · ${formatHours(expected)} expected per person in this sprint so far` : ""}
                        {sprintTotal > 0 ? ` · ${formatHours(sprintTotal)} total sprint hours` : ""}
                      </span>
                    </p>
                    {entries.length === 0 ? (
                      <p className="mt-1 text-sm text-muted">No time logged against this record.</p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-3">
                        {byPerson.map((name) => {
                          const mine = entries.filter((e) => e.person === name);
                          return (
                            <li key={name}>
                              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                                <span>
                                  <span className="font-medium">{name}</span>
                                  {teamOf(name) && <span className="ml-2 text-xs text-muted">{teamOf(name)}</span>}
                                </span>
                                <span className="text-xs tabular-nums text-muted">
                                  {formatHours(sum(mine))}
                                  {expected > 0 ? ` of ${formatHours(expected)} expected` : ""}
                                  {sprintTotal > 0 ? ` · ${formatHours(sprintTotal)} total` : ""}
                                </span>
                              </div>
                              <ul className="mt-1 divide-y divide-border rounded-lg border border-border text-xs">
                                {mine.map((e) => (
                                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-1.5">
                                    <span className="min-w-0">
                                      {formatDay(e.from)} → {formatDay(e.to)} <span className={`${tag} ml-1`}>{e.kind}</span>
                                      {e.notes && <span className="block break-words text-muted">{e.notes}</span>}
                                    </span>
                                    <span className="shrink-0 text-muted">
                                      <span className="tabular-nums text-foreground">{formatHours(e.hours)}</span>
                                      {e.createdAt && <span className="block">logged {entryWhen(e)}</span>}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="mt-3">
                    {/* About 3 entries are visible below; the rest scroll inside the list (the same limit as the activity list in the task panels). */}
                    <p className="text-xs font-medium text-muted">Activity in this sprint</p>
                    {log.length === 0 ? (
                      <p className="mt-1 text-sm text-muted">No activity recorded.</p>
                    ) : (
                      <ul className="mt-1 max-h-[5.6rem] divide-y divide-border overflow-y-auto rounded-lg border border-border text-xs">
                        {newestFirst(log).map((a, i) => (
                          <li key={i} className="flex justify-between gap-3 px-3 py-1.5">
                            <span className="min-w-0 break-words">{a.text}</span>
                            <span className="shrink-0 text-muted">{formatActivityTime(a)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted">
            Not available from the backend, so not shown: comments, the reason a task was carried over or moved, remaining work per sprint, and daily progress notes.
          </p>
        </section>
    </>
  );
}

/** Large dialog with a full-screen toggle, Close button and scrolling content. */
export function HistoryDialog({ title, label, onClose, children }: { title: string; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onCancel={(e) => e.target === e.currentTarget && (e.preventDefault(), ref.current?.close())}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-label={label}
      className={`fixed m-auto flex flex-col overflow-hidden border border-border bg-surface p-0 text-foreground shadow-modal backdrop:bg-black/50 ${
        full ? "h-dvh max-h-dvh w-screen max-w-none rounded-none" : "h-[85vh] w-[min(64rem,calc(100vw-2rem))] max-w-none rounded-2xl"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setFull((v) => !v)} aria-pressed={full} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
            {full ? "Exit full screen" : "Full screen"}
          </button>
          <button type="button" onClick={() => ref.current?.close()} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
            Close
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">{children}</div>
    </dialog>
  );
}

/** One task's details, sprint timeline and work, in a large dialog. */
export default function TaskHistoryModal(props: TaskHistoryModalProps & { onClose: () => void }) {
  const { onClose, ...body } = props;
  return (
    <HistoryDialog title={props.item.title} label={`${props.item.title} history`} onClose={onClose}>
      <TaskHistoryBody {...body} />
    </HistoryDialog>
  );
}
