import { db, nextId, save, type DbItem, type DbSprint } from "../db";
import { addDays, clean, codeOf, logActivity, nowISO, requireAdmin, requireUser, str, todayISO, type Req } from "../core";
import { fail } from "../errors";
import { ticketCode } from "./items";

const out = (s: DbSprint) => ({ id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate, goal: s.goal ?? "", status: s.status, ...(s.closedAt ? { closedAt: s.closedAt } : {}) });
const find = (id: unknown): DbSprint => {
  const s = db().sprints.find((x) => x.id === Number(id));
  if (!s) fail(404, "That sprint doesn't exist.");
  return s as DbSprint;
};
const running = () => db().sprints.find((s) => s.status === "ACTIVE");

/**
 * Closes a sprint: it becomes read-only, the sprint after it waits as Paused, and every task that is not Done is copied into that next sprint (into the
 * Backlog when there is none). The original stays in the closed sprint as history, and the copy points back to it. Closing a closed sprint changes nothing.
 */
export function closeSprint(sprint: DbSprint) {
  const carried: { from: string; to: string }[] = [];
  if (sprint.status === "CLOSED") return carried;
  const d = db();
  sprint.status = "CLOSED";
  sprint.closedAt = nowISO();
  const next = d.sprints.filter((s) => s.status !== "CLOSED" && s.id !== sprint.id && s.startDate >= sprint.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id)[0];
  if (next) next.status = "PAUSED";
  const unfinished = d.items.filter((i) => i.sprintId === sprint.id && i.status !== "COMPLETED");
  const copies = new Map<number, DbItem>();
  for (const original of unfinished) {
    const copy: DbItem = {
      ...original,
      id: nextId("item"),
      // a carried Ticket gets its own next TKT code; any other task is BLG-<id> again
      code: original.type === "TICKET" ? ticketCode() : undefined,
      sprintId: next?.id ?? null,
      podId: next ? original.podId : null,
      carriedFromId: original.id,
      historySprintIds: next ? [next.id] : [],
      hidden: false,
      activity: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      completedAt: null,
    };
    logActivity(copy, `Carried over from ${codeOf(original)} when ${sprint.name} closed`);
    d.items.push(copy);
    copies.set(original.id, copy);
    carried.push({ from: codeOf(original), to: codeOf(copy) });
  }
  // Carried tasks that belonged together stay together: a copy sits under the copy of its parent.
  for (const copy of copies.values()) {
    if (copy.parentId != null && copies.has(copy.parentId)) copy.parentId = copies.get(copy.parentId)!.id;
  }
  return carried;
}

/** A running sprint closes by itself once its end date has passed. Run whenever the sprints are read. */
function closeOverdue() {
  const today = todayISO();
  let changed = false;
  for (const s of db().sprints) {
    if (s.status === "ACTIVE" && s.endDate < today) {
      closeSprint(s);
      changed = true;
    }
  }
  if (changed) save();
}

export function list() {
  requireUser();
  closeOverdue();
  return db().sprints.map(out);
}

function checkName(name: string, selfId?: number) {
  if (!name) fail(400, "Enter a sprint name.");
  if (name.toLowerCase() === "unplanned" || db().sprints.some((s) => s.id !== selfId && s.name.toLowerCase() === name.toLowerCase())) fail(409, "A sprint with this name already exists.");
}

export function create({ data }: Req) {
  requireAdmin();
  const name = clean(data.name);
  checkName(name);
  const startDate = str(data.startDate)?.slice(0, 10) || todayISO();
  if (Number.isNaN(Date.parse(startDate))) fail(400, "Enter a valid start date.");
  const endDate = addDays(startDate, 13);
  const live = running();
  // Only one sprint runs at a time: a new one may not overlap the running one's dates.
  if (live && startDate <= live.endDate && endDate >= live.startDate) fail(409, "A sprint is already running for these dates. Close the running sprint first.");
  const sprint: DbSprint = { id: nextId("sprint"), name, startDate, endDate, goal: str(data.goal) ? clean(data.goal) : "", status: !live && startDate <= todayISO() ? "ACTIVE" : "PAUSED", createdAt: nowISO() };
  db().sprints.push(sprint);
  save();
  return out(sprint);
}

export function update({ params, data }: Req) {
  requireAdmin();
  const sprint = find(params.id);
  if (sprint.status === "CLOSED") fail(403, "A closed sprint can't be changed.");
  if (data.name !== undefined) {
    const name = clean(data.name);
    checkName(name, sprint.id);
    sprint.name = name;
  }
  if (data.startDate) {
    const startDate = String(data.startDate).slice(0, 10);
    if (Number.isNaN(Date.parse(startDate))) fail(400, "Enter a valid start date.");
    sprint.startDate = startDate;
    sprint.endDate = addDays(startDate, 13);
  }
  if (data.goal !== undefined) sprint.goal = clean(data.goal);
  save();
  return out(sprint);
}

export function close({ params }: Req) {
  requireAdmin();
  const sprint = find(params.id);
  const carriedOver = closeSprint(sprint);
  save();
  return { closed: out(sprint), carriedOver };
}

export function start({ params }: Req) {
  requireAdmin();
  const sprint = find(params.id);
  if (sprint.status === "CLOSED") fail(400, "A closed sprint can't be started again.");
  const live = running();
  if (live && live.id !== sprint.id) fail(409, "Another sprint is already running. Close it first.");
  sprint.status = "ACTIVE";
  save();
  return out(sprint);
}

export function remove({ params }: Req) {
  requireAdmin();
  const sprint = find(params.id);
  if (sprint.status === "ACTIVE") fail(409, "This sprint is running. Close it before deleting it.");
  const d = db();
  // Its tasks go back to the Backlog and its time logs are removed.
  for (const item of d.items) {
    if (item.sprintId === sprint.id) {
      item.sprintId = null;
      item.podId = null;
    }
  }
  d.entries = d.entries.filter((e) => e.sprintId !== sprint.id);
  d.sprints = d.sprints.filter((s) => s.id !== sprint.id);
  save();
  return null;
}
