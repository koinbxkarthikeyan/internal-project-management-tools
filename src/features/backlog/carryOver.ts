import type { BacklogItemData, Sprint } from "@/types/backlog";

/** What the carry-over label says when the sprint id in the history can't be found in the sprint data. */
const UNKNOWN_SOURCE = "an earlier sprint";

/**
 * Where a task was carried over from: the name of the sprint it was in just before its current one, or "Backlog" when that was no sprint at all.
 * Returns null when it was not carried over (a task that is new has history that holds only its current sprint, or none).
 *
 * `history.sprintIds` is the source of truth: ids of the sprints the task has been in, in order, and `null` for Backlog. A sprint id is turned into a
 * name only from the real sprint data, never from the number. A repeated entry counts once. When the current sprint is in the list, the entry
 * before it is the source; when it is not, the last entry is. A task that only has its own sprint in the history is not a carry-over.
 * Tasks the backend sent without any history are left to the caller's own fallback (this returns null for them).
 */
export function carryOverSource(task: Pick<BacklogItemData, "sprint" | "historySprintIds">, sprints: readonly Pick<Sprint, "id" | "name">[]): string | null {
  const raw = task.historySprintIds;
  if (!raw || raw.length === 0) return null;
  const ids = raw.filter((id, i) => raw.indexOf(id) === i); // each sprint (or Backlog) once, in order
  // The sprint the task is in now; Backlog ("Unplanned") is `null`, like in the history.
  const current = task.sprint === "Unplanned" ? null : (sprints.find((s) => s.name === task.sprint)?.id ?? undefined);
  const at = current === undefined ? -1 : ids.lastIndexOf(current);
  const source = at >= 0 ? (at > 0 ? ids[at - 1] : undefined) : ids[ids.length - 1];
  if (source === undefined) return null;
  if (source === null) return "Backlog";
  return sprints.find((s) => s.id === source)?.name ?? UNKNOWN_SOURCE;
}
