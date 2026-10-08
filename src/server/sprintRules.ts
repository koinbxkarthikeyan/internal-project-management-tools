import { HttpError, type Db } from "@/server/db";

/** Every sprint lasts exactly two weeks: 14 days, so the end date is the start date + 13. */
export const SPRINT_DAYS = 14;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The end date of a two-week sprint starting on `start`; throws if `start` isn't a date. */
export function sprintEndFor(start: string) {
  if (!ISO.test(start)) throw new HttpError(400, "Start date is invalid");
  return addDays(start, SPRINT_DAYS - 1);
}

/** Keeps only ids of PODs that exist, without duplicates. */
export function validPodIds(db: Db, ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(db.pods.map((p) => p.id));
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && known.has(id)))];
}

/** The sprint that is currently running, if any (the built-in "Unplanned" sprint never runs). */
export const activeSprint = (db: Db) => db.sprints.find((s) => s.name !== "Unplanned" && s.status === "Active");

/** Throws if a sprint is already running, so a new one can't be started until it is closed. */
export function assertNoRunningSprint(db: Db) {
  const running = activeSprint(db);
  if (running) {
    throw new HttpError(
      409,
      `${running.name} is still running. Close it before starting the next sprint.`,
      "sprint_running",
    );
  }
}

/**
 * Gives every sprint a status and makes sure at most one is Active. Older sprints had no status:
 * the one running today stays Active (else the next upcoming one) and the rest are Closed.
 * Returns whether anything changed.
 */
export function normalizeSprintStatuses(db: Db): boolean {
  const real = db.sprints.filter((s) => s.name !== "Unplanned");
  const needsWork = real.some((s) => !s.status) || real.filter((s) => s.status === "Active").length > 1;
  if (!needsWork) return false;

  const today = new Date().toISOString().slice(0, 10);
  const byStartDesc = (a: (typeof real)[number], b: (typeof real)[number]) => (b.start ?? "").localeCompare(a.start ?? "");
  const keep =
    real.filter((s) => s.status === "Active").sort(byStartDesc)[0] ??
    real.filter((s) => s.start && s.end && s.start <= today && today <= s.end).sort(byStartDesc)[0] ??
    real.filter((s) => s.start && s.start > today).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0];

  for (const s of real) s.status = s === keep ? "Active" : "Closed";
  return true;
}

/**
 * Checks where a task is being put: "Unplanned", or the running sprint (a POD is optional, but if given it must
 * belong to that sprint). Tasks can't be planned into a closed sprint.
 */
export function assertPlacement(db: Db, sprintName: string, podId?: string) {
  if (sprintName === "Unplanned") return;
  const sprint = db.sprints.find((s) => s.name === sprintName);
  if (!sprint) throw new HttpError(400, "Choose a Sprint or Unplanned Task");
  if (sprint.status !== "Active") throw new HttpError(409, `${sprint.name} is closed. Tasks can only be planned into the running sprint.`, "sprint_closed");
  if (podId && !(sprint.podIds ?? []).includes(podId)) throw new HttpError(400, "That POD doesn't belong to the running sprint");
}

/** Time can only be logged against (or changed in) the sprint that is running, not a closed one. */
export function assertSprintRunning(db: Db, sprintId: string) {
  const sprint = db.sprints.find((s) => s.id === sprintId);
  if (!sprint) throw new HttpError(400, "Sprint not found");
  if (sprint.status !== "Active") throw new HttpError(409, `${sprint.name} is closed, so time can't be logged against it.`, "sprint_closed");
}

/** Today's date (YYYY-MM-DD) in the server's local time, which is when a sprint's last day counts as over. */
export function localToday(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The name for the sprint after `db`'s latest numbered one: "Sprint 3" when "Sprint 2" is the highest. */
function nextSprintName(db: Db) {
  const highest = db.sprints.reduce((max, s) => Math.max(max, Number(/^Sprint (\d+)$/i.exec(s.name)?.[1]) || 0), 0);
  let n = highest + 1;
  while (db.sprints.some((s) => s.name.toLowerCase() === `sprint ${n}`)) n += 1;
  return `Sprint ${n}`;
}

/**
 * Closes a sprint and starts the next one straight after it:
 * - the closed sprint is left exactly as it was: all its tasks (finished or not) and its logged time stay in it;
 * - every task that is not Completed is copied into the new sprint as a new task (new id, same details and POD, since
 *   the new sprint keeps the same PODs) with `carriedFrom` pointing at the original, so the history can be followed;
 * - the new sprint is Active, starts the day after the old one ends and lasts the fixed two weeks.
 * A sprint closed by hand before its end date ends today instead, so the two never overlap.
 * Returns the new sprint.
 */
export function closeAndStartNext(db: Db, sprintId: string, today: string, manual: boolean) {
  const closing = db.sprints.find((s) => s.id === sprintId);
  if (!closing) throw new HttpError(404, "Sprint not found");

  closing.status = "Closed";
  closing.closedAt = new Date().toISOString();
  if (manual && closing.end && today < closing.end) closing.end = today < (closing.start ?? today) ? closing.start : today;

  const start = addDays(closing.end ?? today, 1);
  const next = {
    id: `sprint-${crypto.randomUUID()}`,
    name: nextSprintName(db),
    start,
    end: sprintEndFor(start),
    goal: "",
    podIds: [...(closing.podIds ?? [])],
    status: "Active" as const,
  };
  const at = db.sprints.findIndex((s) => s.name === "Unplanned");
  db.sprints.splice(at === -1 ? db.sprints.length : at, 0, next);

  let maxId = db.items.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, "")) || 0), 0);
  const copies = db.items
    .filter((i) => i.sprint === closing.name && i.status !== "Completed")
    .map((original) => {
      maxId += 1;
      const { completed: _completed, ...details } = original;
      void _completed;
      return {
        ...details,
        id: `BLG-${maxId}`,
        sprint: next.name,
        created: today,
        carriedFrom: original.id,
        activity: [{ date: today, text: `Carried over from ${original.id} (${closing.name})` }],
      };
    });
  // Newest first, like new tasks everywhere else.
  db.items.unshift(...copies);
  return next;
}

/**
 * Closes the running sprint once its end date is over, and starts the next one (repeating if the server was idle
 * for several sprints). Returns whether anything changed.
 */
export function autoRollover(db: Db, today = localToday()): boolean {
  let changed = false;
  for (let i = 0; i < 60; i += 1) {
    const running = activeSprint(db);
    if (!running?.end || today <= running.end) break;
    closeAndStartNext(db, running.id, today, false);
    changed = true;
  }
  return changed;
}
