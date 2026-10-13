"use client";

import { useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";
import { SPRINT_TASKS_POD, UNPLANNED_POD, isPseudoPod } from "@/constants/work";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import type { Pod, WorkEntry } from "@/types/work";
import TaskHistoryModal from "./TaskHistoryModal";
import TaskSprintHours, { carriedChain } from "./TaskSprintHours";
import { formatDay, formatHours } from "../utils";

type DatedSprint = Sprint & { start: string; end: string };

/** The tasks ticked for the next time entry. They belong to one POD of one sprint, plus any Unplanned tasks. */
export type TaskSelection = { sprintId: string; podId: string; itemIds: string[] };

type Group = { pod: Pod; tasks: BacklogItemData[] };

type SprintPodTasksProps = {
  sprints: readonly DatedSprint[];
  pods: readonly Pod[];
  /** Tasks that aren't hidden. */
  items: readonly BacklogItemData[];
  selection: TaskSelection | null;
  /** Tasks already logged by this person, by sprint id: shown disabled in that sprint. */
  loggedBySprint?: Readonly<Record<string, ReadonlySet<string>>>;
  /** Who is logging, and their entries in every sprint (for the hours shown under a ticked task). */
  person: string;
  entries: readonly WorkEntry[];
  /** Every task (hidden too) and every sprint, to follow a carried-over task back to its original. */
  allTasks: readonly BacklogItemData[];
  allSprints: readonly Sprint[];
  /** Everyone's logged entries (for the History view; `entries` above are only the signed-in person's). */
  everyoneEntries?: readonly WorkEntry[];
  onToggle: (sprint: DatedSprint, pod: Pod, item: BacklogItemData) => void;
};

/** Each selected sprint, its PODs, and under every POD the tasks you can pick from. */
export default function SprintPodTasks({ sprints, pods, items, selection, loggedBySprint = {}, person, entries, allTasks, allSprints, everyoneEntries, onToggle }: SprintPodTasksProps) {
  const unplanned = items.filter((i) => i.sprint === "Unplanned");
  // "Sprint 1: 0h | Sprint 2: 5h | Total: 5h" for one task: the signed-in person's hours on it in every sprint it lived in
  // (the task itself and the earlier records it was carried over from), each sprint kept apart, each entry counted once.
  const own = [...new Map(entries.map((e) => [e.id, e])).values()];
  function sprintTime(task: BacklogItemData) {
    const records = [...carriedChain(task, allTasks)].reverse().concat(task);
    const parts = records.map((r) => ({
      name: r.sprint,
      hours: own.filter((e) => e.itemIds?.includes(r.id)).reduce((sum, e) => sum + e.hours, 0),
    }));
    return { parts, total: parts.reduce((sum, r) => sum + r.hours, 0) };
  }

  // The task whose details are open in the side panel (view only).
  const [viewing, setViewing] = useState<BacklogItemData | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold">Pick what you&apos;re working on</h2>
        <p className="mt-1 text-xs text-muted">Tick one or more tasks from a single POD, and any Unplanned tasks too, then log your time below.</p>
      </div>

      {sprints.every((s) => s.status === "Closed") && (
        <EmptyState
          compact
          title="No running sprint selected"
          description="A closed sprint is history: its tasks and hours are kept, but you log new time in the running sprint."
        />
      )}

      {/* Closed sprints don't appear here: only the running sprint is worked in. */}
      {sprints.filter((s) => s.status !== "Closed").map((sprint) => {
        const closed = sprint.status === "Closed";
        const logged = loggedBySprint[sprint.id];
        // A task already logged in this sprint stays in the list but can't be picked again (unless it's ticked right now).
        const taken = (t: BacklogItemData) => !!logged?.has(t.id) && !(selection?.sprintId === sprint.id && selection.itemIds.includes(t.id));
        const groups: Group[] = (sprint.podIds ?? [])
          .flatMap((id) => pods.filter((p) => p.id === id))
          .map((pod) => ({ pod, tasks: items.filter((i) => i.sprint === sprint.name && i.podId === pod.id) }))
          // A POD with no tasks isn't shown here (it stays on Sprint plan).
          .filter((g) => g.tasks.length > 0);
        // Unplanned Tasks can be worked on during the running sprint.
        // Tasks planned into the sprint without a POD.
        const sprintTasks = items.filter((i) => i.sprint === sprint.name && !i.podId);
        if (sprintTasks.length > 0) groups.push({ pod: { ...SPRINT_TASKS_POD }, tasks: sprintTasks });
        if (!closed && unplanned.length > 0) groups.push({ pod: { ...UNPLANNED_POD }, tasks: unplanned });

        return (
          <section key={sprint.id} aria-label={sprint.name} className="flex flex-col gap-3">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
              {sprint.name}
              <span className="text-xs font-normal text-muted">
                {formatDay(sprint.start)} – {formatDay(sprint.end)}
              </span>
              {closed && <span className="text-xs font-normal text-muted">· Closed: view only, time can&apos;t be logged</span>}
            </h3>

            {groups.length === 0 ? (
              <EmptyState compact title="No tasks to pick yet" description="PODs appear here once they have tasks. Add tasks with Create backlog." />
            ) : (
              groups.map(({ pod, tasks }) => {
                const picked = selection?.sprintId === sprint.id && (isPseudoPod(pod.id) || selection.podId === pod.id) ? selection.itemIds : [];
                return (
                  // Same minimum height for every card; a long list scrolls inside the card, under its header.
                  <div key={pod.id} className="flex min-h-[13rem] flex-col overflow-hidden rounded-xl border border-border bg-background/60">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                      <h4 className="text-sm font-medium">{pod.id === UNPLANNED_POD.id ? "Unplanned tasks" : pod.name}</h4>
                      <span className="text-xs tabular-nums text-muted">
                        {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                      </span>
                    </div>
                    {tasks.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted">No tasks in this POD yet. Create one with Create backlog.</p>
                    ) : (
                      <ul className="max-h-[20.5rem] min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                        {tasks.map((task) => {
                          const locked = closed || taken(task);
                          return (
                            <li key={task.id}>
                              <div className="flex flex-wrap items-center">
                              <label
                                className={`flex min-w-0 flex-1 basis-60 items-center gap-3 pl-4 py-2.5 text-sm transition-colors ${
                                  locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-hover"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={picked.includes(task.id)}
                                  disabled={locked}
                                  onChange={() => onToggle(sprint, pod, task)}
                                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                                />
                                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                                {task.carriedFrom && (
                                  <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                    Carried from {allTasks.find((t) => t.id === task.carriedFrom)?.sprint ?? "an earlier sprint"}
                                  </span>
                                )}
                                <StatusBadge status={task.status} />
                              </label>
                              {/* Outside the label, so opening the details never ticks the task. */}
                              <span className="ml-auto shrink-0 whitespace-nowrap py-2.5 pl-4 font-mono text-[11px] text-muted" title="Your hours on this task, per sprint">
                                {(() => {
                                  const t = sprintTime(task);
                                  return `${t.parts.map((r) => `${r.name}: ${formatHours(r.hours)}`).join(" | ")} | Total: ${formatHours(t.total)}`;
                                })()}
                              </span>
                              <button
                                type="button"
                                onClick={() => setViewing(task)}
                                aria-label={`View ${task.title}`}
                                className="shrink-0 px-4 py-2.5 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                              >
                                View
                              </button>
                              </div>
                              {picked.includes(task.id) && (
                                <TaskSprintHours task={task} sprint={sprint} person={person} entries={entries} allTasks={allTasks} allSprints={allSprints} />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </section>
        );
      })}
      {viewing && (
        <TaskHistoryModal key={viewing.id} item={viewing} allTasks={allTasks} allSprints={allSprints} allEntries={everyoneEntries ?? entries} onlyMine onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
