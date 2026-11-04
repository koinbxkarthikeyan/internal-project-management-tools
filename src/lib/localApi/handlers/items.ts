import { db, nextId, save, type DbItem, type DbUser } from "../db";
import { clean, codeOf, findItem, isAdminUser, isQaUser, isSprintClosed, logActivity, nowISO, num, requireAdmin, requireUser, str, todayISO, userRef, type Req, type Rec } from "../core";
import { fail } from "../errors";
import { deleteFile } from "../blobStore";
import { followers, notify } from "./notifications";

// ---------- what a task looks like to the screens ----------

const STATUS_LABEL: Record<string, string> = { OPEN: "To Do", IN_PROGRESS: "In progress", READY_FOR_QA: "Ready for QA", TESTING: "Testing", BLOCKED: "Blocked", ON_HOLD: "On hold", COMPLETED: "Done" };
const label = (status: string) => STATUS_LABEL[status] ?? status;

export function itemOut(i: DbItem, me: DbUser, withActivity = false): Rec {
  const d = db();
  const sprint = i.sprintId == null ? undefined : d.sprints.find((s) => s.id === i.sprintId);
  const owner = i.ownerId == null ? undefined : d.owners.find((o) => o.id === i.ownerId);
  const parent = i.parentId == null ? undefined : d.items.find((p) => p.id === i.parentId);
  const readOnly = sprint?.status === "CLOSED";
  return {
    id: i.id,
    code: codeOf(i),
    ...(i.type !== "TICKET" ? { ticketStats: ticketStats(i.id) } : {}),
    title: i.title,
    ...(i.description ? { description: i.description } : {}),
    ...(i.notes ? { notes: i.notes } : {}),
    priority: i.priority,
    type: i.type,
    status: i.status,
    ...(owner ? { ownerId: owner.id, owner: { id: owner.id, name: owner.name } } : {}),
    ...(sprint ? { sprintId: sprint.id, sprint: { id: sprint.id, name: sprint.name } } : {}),
    ...(i.podId != null ? { podId: i.podId } : {}),
    ...(i.leadId != null && userRef(i.leadId) ? { leadId: i.leadId, lead: userRef(i.leadId) } : {}),
    assignees: i.assigneeIds.flatMap((id) => userRef(id) ?? []),
    expectedDeadline: i.expectedDeadline ?? null,
    leadDeadline: i.leadDeadline ?? null,
    ...(i.readyForQaDate ? { readyForQaDate: i.readyForQaDate } : {}),
    completedAt: i.completedAt ?? null,
    ...(i.reopenedAt ? { reopenedAt: i.reopenedAt } : {}),
    ...(i.completedFrom ? { completedFrom: i.completedFrom } : {}),
    hidden: !!i.hidden,
    ...(parent ? { parentId: parent.id, parentCode: codeOf(parent) } : {}),
    ...(i.carriedFromId != null ? { carriedFromId: i.carriedFromId } : {}),
    history: { sprintIds: i.historySprintIds.length ? i.historySprintIds : i.sprintId != null ? [i.sprintId] : [] },
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    ...(userRef(i.createdById) ? { createdBy: userRef(i.createdById) } : {}),
    // Created By Team stays as it was at creation (older records fall back to the creator's current team); Assigned Team follows the assignee's team now, so it changes when the Ticket is reassigned.
    ...(i.createdById != null ? { createdByTeam: i.createdByTeam !== undefined ? i.createdByTeam : (d.users.find((u) => u.id === i.createdById)?.team ?? null) } : {}),
    ...(i.type === "TICKET" && i.assigneeIds.length ? { assignedTeam: d.users.find((u) => u.id === i.assigneeIds[0])?.team ?? null } : {}),
    ...(userRef(i.updatedById) ? { updatedBy: userRef(i.updatedById) } : {}),
    commentCount: d.comments.filter((c) => c.itemId === i.id).length,
    readOnly,
    canLeadEdit: !readOnly && i.leadId === me.id,
    ...(withActivity ? { activity: i.activity.map((a) => ({ id: a.id, text: a.text, createdAt: a.createdAt, ...(userRef(a.userId) ? { user: userRef(a.userId) } : {}), ...(a.reopen ? { reopen: a.reopen } : {}) })) } : {}),
  };
}

const byNewest = (a: DbItem, b: DbItem) => b.id - a.id;

export function list({ query }: Req) {
  const me = requireUser();
  const hidden = query.hidden === true || query.hidden === "true";
  const page = Math.max(1, num(query.page) ?? 1);
  const limit = Math.min(200, Math.max(1, num(query.limit) ?? 10));
  // Tickets are not rows of the Backlog: they live inside their task (see `tickets`).
  const all = db().items.filter((i) => !!i.hidden === hidden && i.type !== "TICKET").sort(byNewest);
  return { items: all.slice((page - 1) * limit, page * limit).map((i) => itemOut(i, me)), total: all.length, page, limit };
}

/**
 * The tasks a person works with: those they lead, those they are assigned to, and those nobody is on yet. Only Backlog tasks are listed: a Ticket is never a row
 * of its own here. A task that holds a Ticket assigned to the person is listed under "assigned", so they can reach that Ticket through it; the Tickets themselves
 * come separately (`tickets`), for opening one by its code.
 */
export function mine() {
  const me = requireUser();
  const visible = db().items.filter((i) => !i.hidden).sort(byNewest);
  const tasks = visible.filter((i) => i.type !== "TICKET");
  const myTickets = visible.filter((i) => i.type === "TICKET" && i.assigneeIds.includes(me.id));
  const parents = new Set(myTickets.flatMap((t) => (t.parentId == null ? [] : [rootOf(t).id])));
  return {
    lead: tasks.filter((i) => i.leadId === me.id).map((i) => itemOut(i, me)),
    assigned: tasks.filter((i) => i.assigneeIds.includes(me.id) || parents.has(i.id)).map((i) => itemOut(i, me)),
    unassigned: tasks.filter((i) => i.leadId == null && i.assigneeIds.length === 0).map((i) => itemOut(i, me)),
    tickets: myTickets.map((i) => itemOut(i, me)),
  };
}

export const get = ({ params }: Req) => itemOut(findItem(params.id), requireUser(), true);

// ---------- Bug and Ticket hierarchy ----------

const TOP_LEVEL = ["FEATURE", "ENHANCEMENT", "TASK", "TECH_DEBT"];
const TYPES = [...TOP_LEVEL, "BUG", "TICKET"];
const typeName = (t: string) => t.toLowerCase().replace(/_/g, " ");

/**
 * Backlog task, then Bug, then Ticket. A top-level task has no parent; a Bug may sit under a top-level task; a Ticket sits directly under a task
 * (how QA works in Ready for QA) or under a Bug, and holds nothing. A task that has children keeps a type that can hold them.
 */
function checkHierarchy(item: Pick<DbItem, "id" | "type" | "parentId">) {
  const d = db();
  const parent = item.parentId == null ? undefined : d.items.find((p) => p.id === item.parentId);
  if (item.parentId != null && !parent) fail(400, "The parent task doesn't exist.");
  if (parent && parent.id === item.id) fail(400, "A task can't be its own parent.");
  if (TOP_LEVEL.includes(item.type) && parent) fail(400, `A ${typeName(item.type)} is a top-level task and can't have a parent.`);
  if (item.type === "BUG" && parent && !TOP_LEVEL.includes(parent.type)) fail(400, "A Bug can only sit under a Feature, Enhancement, Task or Tech Debt.");
  if (item.type === "TICKET") {
    if (!parent) fail(400, "A Ticket needs a parent task.");
    if (parent && parent.type === "TICKET") fail(400, "A Ticket can't sit under another Ticket.");
  }
  const children = d.items.filter((c) => c.parentId === item.id);
  if (item.type === "TICKET" && children.length) fail(400, "A Ticket can't have child tasks.");
  if (item.type === "BUG" && children.some((c) => c.type !== "TICKET")) fail(400, "A Bug can only hold Tickets.");
  if (TOP_LEVEL.includes(item.type) && children.some((c) => c.type !== "BUG" && c.type !== "TICKET")) fail(400, "Only Bugs and Tickets can sit under this task.");
}

// ---------- reading a request body ----------

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOT_SET"];
const STATUSES = Object.keys(STATUS_LABEL);

const enumOf = (v: unknown, allowed: string[], what: string): string => {
  const x = String(v ?? "").toUpperCase();
  if (!allowed.includes(x)) fail(400, `Choose a valid ${what}.`);
  return x;
};
const dateOf = (v: unknown): string | null => {
  if (v === null || v === "" || v === undefined) return null;
  const s = String(v).slice(0, 10);
  if (Number.isNaN(Date.parse(s))) fail(400, "Enter a valid date.");
  return s;
};
const idOrNull = (v: unknown): number | null => (v === null || v === "" || v === undefined ? null : Number(v));

function checkRefs(item: Pick<DbItem, "ownerId" | "sprintId" | "podId" | "leadId" | "assigneeIds">) {
  const d = db();
  if (item.ownerId != null && !d.owners.some((o) => o.id === item.ownerId)) fail(400, "That owner doesn't exist.");
  if (item.sprintId != null && !d.sprints.some((s) => s.id === item.sprintId)) fail(400, "That sprint doesn't exist.");
  if (item.podId != null && !d.pods.some((p) => p.id === item.podId)) fail(400, "That POD doesn't exist.");
  if (item.leadId != null && !d.users.some((u) => u.id === item.leadId)) fail(400, "That lead doesn't exist.");
  if (item.assigneeIds.some((id) => !d.users.some((u) => u.id === id))) fail(400, "One of the assigned users doesn't exist.");
}

/** The next Ticket code, TKT-001, TKT-002, ... (counted separately from the other tasks' BLG codes). */
export const ticketCode = () => `TKT-${String(++db().seq.ticket).padStart(3, "0")}`;

const CLOSED = "That sprint is closed, so its tasks can only be viewed.";

// ---------- create ----------

export function createItem(data: Rec, me: DbUser): DbItem {
  const title = clean(data.title);
  if (!title) fail(400, "Enter a title.");
  const sprintId = idOrNull(data.sprintId);
  if (isSprintClosed(sprintId)) fail(400, CLOSED);
  const type = data.type === undefined ? "TASK" : enumOf(data.type, TYPES, "type");
  const item: DbItem = {
    id: nextId("item"),
    ...(type === "TICKET" ? { code: ticketCode() } : {}),
    title,
    ...(str(data.description) ? { description: String(data.description) } : {}),
    ...(str(data.notes) ? { notes: String(data.notes) } : {}),
    priority: data.priority === undefined ? "NOT_SET" : enumOf(data.priority, PRIORITIES, "priority"),
    type,
    status: "OPEN",
    ownerId: idOrNull(data.ownerId),
    sprintId,
    podId: sprintId == null ? null : idOrNull(data.podId),
    leadId: idOrNull(data.leadId),
    assigneeIds: Array.isArray(data.assigneeIds) ? [...new Set(data.assigneeIds.map(Number))] : [],
    expectedDeadline: dateOf(data.expectedDeadline),
    leadDeadline: null,
    parentId: idOrNull(data.parentId),
    hidden: false,
    historySprintIds: sprintId == null ? [] : [sprintId],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdById: me.id,
    createdByTeam: me.team ?? null,
    updatedById: me.id,
    activity: [],
  };
  checkRefs(item);
  checkHierarchy(item);
  logActivity(item, "Created", me.id);
  db().items.push(item);
  // Only the people the new task or Ticket is actually assigned to (its Lead and Assigned Users) are told: never someone just because it was made under their task.
  notify(item, "task.assigned", me, [item.leadId, ...item.assigneeIds], [{ field: "Assigned", to: "you" }], item.type === "TICKET" ? "assigned this Ticket to you" : undefined);
  return item;
}

export function create({ data }: Req) {
  const me = requireAdmin();
  const item = createItem(data, me);
  save();
  return itemOut(item, me, true);
}

// ---------- change ----------

/** Applies the status rules and records the new state; returns whether it changed. */
function applyStatus(item: DbItem, status: string, me: DbUser): boolean {
  const next = enumOf(status, STATUSES, "status");
  if (next === item.status) return false;
  if (next === "READY_FOR_QA" && item.type === "TICKET") fail(400, "A Ticket can't be set to Ready for QA: that is how a task is handed to QA.");
  // Only QA (and the admins) take a task into Testing.
  // (A Ticket's own people may put the Ticket into Testing too; only Done is held back for QA, the admins and the Ticket's creator.)
  if (next === "TESTING" && item.type !== "TICKET" && !isAdminUser(me) && !isQaUser(me)) fail(403, "Only QA, a Super Admin or an enabled Admin can put a task into Testing.");
  // QA completes the testing of what was handed to them; nobody else but an admin can mark a task Done.
  // (A Ticket's own creator may also finish it: their own Ticket, not anyone else's.)
  if (next === "COMPLETED" && !isAdminUser(me) && !(isQaUser(me) && (inQa(item) || item.type === "TICKET")) && !(item.type === "TICKET" && item.createdById === me.id)) fail(403, "Only a Super Admin, an enabled Admin, or QA (for a task that is Ready for QA, or a Ticket) can mark a task Done.");
  const was = item.status;
  item.status = next;
  // Completing stamps today. Reopening keeps the completion details (the date stays as the last time it was completed) and notes the day it was reopened; the
  // status history in the task's activity is never touched.
  if (next === "COMPLETED") {
    item.completedAt = todayISO();
    item.completedFrom = was;
  }
  else if (was === "COMPLETED") item.reopenedAt = todayISO();
  // Entering Ready for QA stamps today's date; any other move leaves the date as it was (it changes only when the task enters Ready for QA again).
  if (next === "READY_FOR_QA") item.readyForQaDate = todayISO();
  return true;
}

/** Everyone in the QA team: told when a task is handed to them. */
const qaTeamIds = () => db().users.filter(isQaUser).map((u) => u.id);

/** In the QA team's hands: handed over (Ready for QA) or being tested. */
const inQa = (item: Pick<DbItem, "status">) => item.status === "READY_FOR_QA" || item.status === "TESTING";

const touch = (item: DbItem, me: DbUser) => {
  item.updatedAt = nowISO();
  item.updatedById = me.id;
};

export function update({ params, data }: Req) {
  const me = requireAdmin();
  const item = findItem(params.id);
  if (isSprintClosed(item.sprintId)) fail(403, CLOSED);
  const before = { ...item, assigneeIds: [...item.assigneeIds] };
  const changed: string[] = [];
  /** Applies one field when it differs from what is stored, and remembers its name for the activity line. */
  const set = (field: string, differs: boolean, apply: () => void) => {
    if (!differs) return;
    apply();
    changed.push(field);
  };
  const text = (v: unknown) => String(v ?? "");

  if (data.title !== undefined) {
    const title = clean(data.title);
    if (!title) fail(400, "Enter a title.");
    set("title", title !== item.title, () => (item.title = title));
  }
  if (data.description !== undefined) set("description", text(data.description) !== (item.description ?? ""), () => (data.description ? (item.description = text(data.description)) : delete item.description));
  if (data.notes !== undefined) set("notes", text(data.notes) !== (item.notes ?? ""), () => (data.notes ? (item.notes = text(data.notes)) : delete item.notes));
  if (data.priority !== undefined) {
    const priority = enumOf(data.priority, PRIORITIES, "priority");
    set("priority", priority !== item.priority, () => (item.priority = priority));
  }
  if (data.type !== undefined) {
    const type = enumOf(data.type, TYPES, "type");
    set("type", type !== item.type, () => (item.type = type));
  }
  if (data.status !== undefined) set("status", enumOf(data.status, STATUSES, "status") !== item.status, () => applyStatus(item, text(data.status), me));
  if (data.expectedDeadline !== undefined) set("expected ETA (Estimated Time of Arrival)", dateOf(data.expectedDeadline) !== (item.expectedDeadline ?? null), () => (item.expectedDeadline = dateOf(data.expectedDeadline)));
  if (data.completedAt !== undefined) set("completed date", dateOf(data.completedAt) !== (item.completedAt ?? null), () => (item.completedAt = dateOf(data.completedAt)));
  if (data.ownerId !== undefined) set("owner", idOrNull(data.ownerId) !== (item.ownerId ?? null), () => (item.ownerId = idOrNull(data.ownerId)));
  if (data.sprintId !== undefined) {
    const sprintId = idOrNull(data.sprintId);
    if (sprintId !== (item.sprintId ?? null) && isSprintClosed(sprintId)) fail(400, CLOSED);
    set("sprint", sprintId !== (item.sprintId ?? null), () => {
      item.sprintId = sprintId;
      if (sprintId == null) item.podId = null;
      else if (item.historySprintIds[item.historySprintIds.length - 1] !== sprintId) item.historySprintIds = [...item.historySprintIds, sprintId];
    });
  }
  if (data.podId !== undefined) set("POD", idOrNull(data.podId) !== (item.podId ?? null), () => (item.podId = item.sprintId == null ? null : idOrNull(data.podId)));
  if (data.leadId !== undefined) set("lead", idOrNull(data.leadId) !== (item.leadId ?? null), () => (item.leadId = idOrNull(data.leadId)));
  if (Array.isArray(data.assigneeIds)) {
    const ids = [...new Set(data.assigneeIds.map(Number))];
    set("assignees", ids.slice().sort().join() !== item.assigneeIds.slice().sort().join(), () => (item.assigneeIds = ids));
  }
  if (data.parentId !== undefined) set("parent", idOrNull(data.parentId) !== (item.parentId ?? null), () => (item.parentId = idOrNull(data.parentId)));

  checkRefs(item);
  checkHierarchy(item);
  if (!changed.length) return itemOut(item, me, true);
  touch(item, me);
  logChanges(item, before, changed, me);
  announce(item, before, me, changed);
  save();
  return itemOut(item, me, true);
}

/** The date as people read it in the history (12 Nov 2026). */
const showDate = (iso?: string | null) => {
  if (!iso) return "no date";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * Writes what a save changed into the task's history, one entry per event (each carries who did it and the exact date and time): a status change (a hand-over to Ready for QA
 * says so), the Developer ETA being set or changed (with the new date) or unset (removed), and one line for the other fields. An entry is written only for a change that happened;
 * earlier entries are never touched, so an ETA that is set and later unset keeps both.
 */
function logChanges(item: DbItem, before: DbItem, changed: string[], me: DbUser) {
  const etaChanged = changed.some((c) => c.startsWith("developer ETA"));
  const rest = changed.filter((c) => c !== "status" && !c.startsWith("developer ETA"));
  if (rest.length) logActivity(item, `Updated ${rest.join(", ")}`, me.id);
  if (changed.includes("status")) logActivity(item, item.status === "READY_FOR_QA" ? `Moved to Ready for QA (status changed from ${label(before.status)})` : `Status changed from ${label(before.status)} to ${label(item.status)}`, me.id);
  if (etaChanged) {
    const was = before.leadDeadline ?? null;
    const now = item.leadDeadline ?? null;
    logActivity(item, now ? `Developer ETA set to ${showDate(now)}${was ? ` (was ${showDate(was)})` : ""}` : `Developer ETA unset: removed (was ${showDate(was)})`, me.id);
  }
}

/** Notifications for what an admin changed: new people are told they were assigned, followers hear about a status or sprint change. */
function announce(item: DbItem, before: DbItem, me: DbUser, changed: string[]) {
  const added = [...(item.leadId !== before.leadId ? [item.leadId] : []), ...item.assigneeIds.filter((id) => !before.assigneeIds.includes(id))];
  if (added.length) notify(item, "task.assigned", me, added, [{ field: "Assigned", to: "you" }], item.type === "TICKET" ? "assigned this Ticket to you" : undefined);
  if (changed.includes("status")) notify(item, "task.status_changed", me, [...followers(item), ...(item.status === "READY_FOR_QA" ? qaTeamIds() : [])], [{ field: "Status", from: label(before.status), to: label(item.status) }]);
  if (changed.includes("sprint")) notify(item, "task.sprint_changed", me, followers(item), [{ field: "Sprint", from: sprintName(before.sprintId), to: sprintName(item.sprintId) }]);
}

const sprintName = (id?: number | null) => (id == null ? "Backlog" : (db().sprints.find((s) => s.id === id)?.name ?? "Sprint"));

/** A task that is with QA (Ready for QA, Testing) is out of the developers' hands: only QA and the admins change it until it comes back to a development status. */
const withQa = (item: DbItem, me: DbUser) => inQa(item) && !isAdminUser(me) && !isQaUser(me);
const WITH_QA = "This task is with QA now, so only QA or an admin can change it.";

/** A Ticket's own people: the person who created it (besides its assignee, QA and the admins). Being the Lead or an Assigned User of the task does not give a say over Tickets other people made or hold. */
const ticketPerson = (item: DbItem, me: DbUser) => item.type === "TICKET" && item.createdById === me.id;

const canWork = (item: DbItem, me: DbUser) => isAdminUser(me) || item.leadId === me.id || item.assigneeIds.includes(me.id) || ticketPerson(item, me) || (isQaUser(me) && (inQa(item) || item.type === "TICKET"));

/** The task's Lead (or an admin) changes status, the assigned users and the Developer ETA. An Assigned User may set the Developer ETA too. */
export function leadUpdate({ params, data }: Req) {
  const me = requireUser();
  const item = findItem(params.id);
  if (!canWork(item, me)) fail(403, "Only the task's Lead, an assigned user or an admin can change this.");
  if (withQa(item, me)) fail(403, WITH_QA);
  if (isSprintClosed(item.sprintId)) fail(403, CLOSED);
  const lead = item.leadId === me.id || isAdminUser(me);
  const before = { ...item, assigneeIds: [...item.assigneeIds] };
  const changed: string[] = [];
  if (data.status !== undefined) {
    if (!lead) fail(403, "Only the task's Lead can change the status here.");
    if (applyStatus(item, String(data.status), me)) changed.push("status");
  }
  if (Array.isArray(data.assigneeIds)) {
    if (!lead) fail(403, "Only the task's Lead can assign users.");
    const ids = [...new Set(data.assigneeIds.map(Number))];
    if (ids.slice().sort().join() !== item.assigneeIds.slice().sort().join()) {
      item.assigneeIds = ids;
      changed.push("assignees");
    }
    checkRefs(item);
  }
  if (data.leadDeadline !== undefined && dateOf(data.leadDeadline) !== (item.leadDeadline ?? null)) {
    if (!lead && !item.assigneeIds.includes(me.id)) fail(403, "Only the task's Lead or an Assigned User can set the Developer ETA.");
    item.leadDeadline = dateOf(data.leadDeadline);
    changed.push("developer ETA (Estimated Time of Arrival)");
  }
  if (!changed.length) return itemOut(item, me, true);
  touch(item, me);
  logChanges(item, before, changed, me);
  announce(item, before, me, changed);
  save();
  return itemOut(item, me, true);
}

/** A status change with what was done, saved together: the note is part of the task's activity. */
/** The note that goes with a status change is also a comment on the task or Ticket (by the person who made the change), so it shows in its conversation as well as in the history. It tells nobody again: the status notice already carries it. */
function commentStatusChange(item: DbItem, me: DbUser, text: string) {
  if (!text) return;
  db().comments.push({ id: nextId("comment"), itemId: item.id, userId: me.id, text: text.slice(0, 2000), createdAt: nowISO(), team: me.team ?? null });
}

export function changeStatus({ params, data }: Req) {
  const me = requireUser();
  const item = findItem(params.id);
  if (!canWork(item, me)) fail(403, "Only the task's Lead, an assigned user or an admin can change the status.");
  if (withQa(item, me)) fail(403, WITH_QA);
  if (isSprintClosed(item.sprintId)) fail(403, CLOSED);
  const details = clean(data.details);
  if (!details) fail(400, "Add a comment about this status change.");
  const before = item.status;
  if (!applyStatus(item, String(data.status ?? ""), me)) return itemOut(item, me, true);
  touch(item, me);
  logActivity(item, `Status changed from ${label(before)} to ${label(item.status)}: ${details}`, me.id);
  commentStatusChange(item, me, details);
  notify(item, "task.status_changed", me, [...followers(item), ...(item.status === "READY_FOR_QA" ? qaTeamIds() : [])], [{ field: "Status", from: label(before), to: label(item.status) }], details.slice(0, 480));
  save();
  return itemOut(item, me, true);
}

export function setVisibility({ params, data }: Req) {
  const me = requireAdmin();
  const item = findItem(params.id);
  if (isSprintClosed(item.sprintId)) fail(403, CLOSED);
  item.hidden = !!data.hidden;
  touch(item, me);
  save();
  return itemOut(item, me);
}

/** Takes one task or Ticket out of the data with what hangs on it: its work entries' links, comments, notices and image attachments (the details here, the files in the image store). Callers check first. */
function eraseItem(item: DbItem) {
  const d = db();
  d.items = d.items.filter((i) => i.id !== item.id);
  for (const e of d.entries) e.itemIds = e.itemIds.filter((id) => id !== item.id);
  d.entries = d.entries.filter((e) => e.itemIds.length > 0 || e.note);
  d.comments = d.comments.filter((c) => c.itemId !== item.id);
  for (const a of d.attachments.filter((x) => x.itemId === item.id)) void deleteFile(a.id).catch(() => undefined);
  d.attachments = d.attachments.filter((a) => a.itemId !== item.id);
  d.notifications = d.notifications.filter((n) => n.taskId !== item.id);
}

export function remove({ params }: Req) {
  requireAdmin();
  const item = findItem(params.id);
  if (isSprintClosed(item.sprintId)) fail(403, CLOSED);
  // A task's child Tickets are deleted with it; child tasks of any other kind must be dealt with first.
  if (db().items.some((c) => c.parentId === item.id && c.type !== "TICKET")) fail(409, "This task has child tasks. Delete or move them first.");
  for (const ticket of descendants(item.id)) eraseItem(ticket);
  eraseItem(item);
  save();
  return null;
}

/** Permanently removes every hidden task together with its child Tickets (and their comments and images). Hidden tasks in a closed sprint stay, as they can't be changed; their number is returned. */
export function removeHidden() {
  requireAdmin();
  const d = db();
  const hidden = d.items.filter((i) => i.hidden);
  const doomed = hidden.filter((i) => !isSprintClosed(i.sprintId));
  const all = [...new Map(doomed.flatMap((i) => [i, ...descendants(i.id)]).map((i) => [i.id, i])).values()];
  for (const item of all) eraseItem(item);
  save();
  return { tasks: all.filter((i) => i.type !== "TICKET").length, tickets: all.filter((i) => i.type === "TICKET").length, skipped: hidden.length - doomed.length };
}

// ---------- Ready for QA ----------

const involvedInQa = (me: DbUser) => isAdminUser(me) || isQaUser(me);

/** How many Tickets a task has, how many are Done, and their codes (to tell which notices are about them). Read fresh each time, so adding or removing a Ticket shows at once. */
const ticketStats = (id: number) => {
  const t = descendants(id).filter((c) => c.type === "TICKET");
  return { total: t.length, done: t.filter((c) => c.status === "COMPLETED").length, codes: t.map((c) => codeOf(c)) };
};

const descendants = (id: number): DbItem[] => db().items.filter((c) => c.parentId === id).flatMap((c) => [c, ...descendants(c.id)]);

/**
 * Every task whose status is Ready for QA (whoever it is assigned to), for the QA team, the Super Admin and enabled Admins. A task stays in the queue
 * until its status changes, for example when QA marks it Done. Each task is the one original record: nothing is copied or renamed for QA.
 */
export function qaQueue() {
  const me = requireUser();
  if (!involvedInQa(me)) fail(403, "Only the QA team, a Super Admin or an enabled Admin can see the Ready for QA section.");
  // Tasks with QA now, and the ones QA has finished (handed over once and now Done) for the page's Completed tab; each carries how many of its Tickets are Done.
  const queue = db().items.filter((i) => !i.hidden && i.type !== "TICKET" && (inQa(i) || (i.status === "COMPLETED" && !!i.readyForQaDate))).sort(byNewest);
  return { queue: queue.map((i) => itemOut(i, me)) };
}

/** The Tickets under a task (directly, or through a Bug under it), oldest first. Anyone who can see the task can read them. */
export function tickets({ params }: Req) {
  const me = requireUser();
  const task = findItem(params.id);
  return { tickets: descendants(task.id).filter((i) => i.type === "TICKET").sort((a, b) => a.id - b.id).map((i) => itemOut(i, me)) };
}

export const rootOf = (item: DbItem): DbItem => {
  let current = item;
  while (current.parentId != null) {
    const parent = db().items.find((p) => p.id === current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
};

/**
 * QA (or an admin) adds a Ticket directly under a task. The Ticket is linked to that task's id and shown inside its details; it starts in the task's sprint,
 * POD and owner. The same title can't be added twice under one task.
 */
export function createTicket({ params, data }: Req) {
  const me = requireUser();
  const parent = findItem(params.id);
  if (parent.type === "TICKET") fail(400, "Tickets can only be created under a task or a Bug.");
  const root = rootOf(parent);
  // Anyone with access (not a disabled account) may add Tickets to a task that is with QA.
  if (me.accessStatus !== "ENABLED") fail(403, "Your access is disabled, so you can't create Tickets.");
  if (isSprintClosed(parent.sprintId)) fail(403, CLOSED);
  // Tickets belong to QA's work: they can be created only once the task has been handed over (Ready for QA, or being tested).
  if (!inQa(root)) fail(403, "Tickets can be created once the task is Ready for QA.");
  const title = clean(data.title);
  if (!title) fail(400, "Enter a title for the Ticket.");
  const d = db();
  if (d.items.some((c) => c.parentId === parent.id && c.type === "TICKET" && c.title.toLowerCase() === title.toLowerCase())) fail(409, "This task already has a Ticket with that title.");
  const assigneeIds = [...new Set([...(Array.isArray(data.assigneeIds) ? data.assigneeIds : []), ...(data.assigneeId ? [data.assigneeId] : [])].map(Number))];
  // The first Ticket the task has (counted before this one is made).
  const firstTicket = isQaUser(me) && !descendants(root.id).some((c) => c.type === "TICKET");
  const ticket = createItem(
    { title, type: "TICKET", parentId: parent.id, priority: data.priority ?? "NOT_SET", description: data.description, ownerId: parent.ownerId, sprintId: parent.sprintId, podId: parent.podId, assigneeIds, expectedDeadline: data.expectedDeadline },
    me,
  );
  // A QA team member who creates a Ticket is added to the task's Assigned Users (everyone already assigned stays), from their own sign-in. Nobody else's creating a Ticket changes
  // the assignment, and the Lead, ETA and the rest of the task are left alone. Adding someone who is already assigned does nothing, so a retry changes nothing.
  if (isQaUser(me)) addAssignee(parent, me);
  // A QA team member's first Ticket on a task that is only waiting for QA takes that task into Testing and leaves a default comment on it. Every part is guarded by the status it
  // changes from, so a repeated request finds the task already in Testing and does not move it, record it or comment again.
  if (firstTicket && root.status === "READY_FOR_QA") {
    root.status = "TESTING";
    touch(root, me);
    logActivity(root, "Status changed from Ready for QA to Testing: a QA team member created the first Ticket", me.id);
    db().comments.push({ id: nextId("comment"), itemId: root.id, userId: me.id, text: "Testing started.", createdAt: nowISO(), team: me.team ?? null });
    notify(root, "task.status_changed", me, followers(root), [{ field: "Status", from: "Ready for QA", to: "Testing" }], "Testing started.");
  }
  // The status the Ticket starts in (it starts To Do unless the form chose one of these).
  if (data.status === "IN_PROGRESS" || data.status === "TESTING") ticket.status = data.status;
  // The task's conversation gets a note with a link to the new Ticket (the Ticket's own conversation stays its own). One Ticket, one note: a repeated request fails above (same title).
  db().comments.push({ id: nextId("comment"), itemId: parent.id, userId: me.id, text: `created Ticket ${codeOf(ticket)} · ${ticket.title}`, createdAt: nowISO(), team: me.team ?? null, ticketId: ticket.id });
  // The people @mentioned in the Ticket's description are told.
  const mentioned = [...new Set((Array.isArray(data.mentionIds) ? data.mentionIds : []).map(Number))].filter((id) => id !== me.id && !ticket.assigneeIds.includes(id) && db().users.some((u) => u.id === id));
  if (mentioned.length) notify(ticket, "task.commented", me, mentioned, undefined, `mentioned you in this Ticket: ${String(ticket.description ?? ticket.title).slice(0, 440)}`);
  // A Ticket created and assigned to the person making it is still a Ticket assigned to them: they get the notification too (nobody else is told on their behalf).
  if (ticket.assigneeIds.includes(me.id)) notify(ticket, "task.assigned", me, [me.id], [{ field: "Assigned", to: "you" }], "assigned this Ticket to you", { includeActor: true });
  save();
  return itemOut(ticket, me, true);
}

/** Adds `me` to the task's Assigned Users, keeping everyone already there, and records who the task is assigned to now (the entry carries its date and time). Nothing happens if they already are. */
function addAssignee(task: DbItem, me: DbUser) {
  if (task.assigneeIds.includes(me.id)) return;
  const before = [...task.assigneeIds];
  const names = (ids: number[]) => (ids.length ? ids.map((id) => userRef(id)?.name ?? "a removed user").join(", ") : "nobody");
  task.assigneeIds = [...before, me.id];
  touch(task, me);
  logActivity(task, `Assigned user added: ${me.name} (assigned now: ${names(task.assigneeIds)}) because they created a Ticket as QA`, me.id);
  notify(task, "task.reassigned", me, [task.leadId, ...before], [{ field: "Assigned", from: names(before), to: names(task.assigneeIds) }]);
}

/** Who may change a Ticket's own things (its fields, its images): QA, the admins, the Ticket's assignee and the person who created it. */
export const canManageTicket = (ticket: DbItem, me: DbUser) => involvedInQa(me) || ticket.assigneeIds.includes(me.id) || ticket.createdById === me.id;

/** QA (or an admin) edits a Ticket's own fields: title, description, priority and assignee. Its status is changed like any task's (see `changeStatus`). */
export function editTicket({ params, data }: Req) {
  const me = requireUser();
  const ticket = findItem(params.id);
  if (ticket.type !== "TICKET") fail(400, "That is not a Ticket.");
  if (!canManageTicket(ticket, me)) fail(403, "Only the Ticket's assignee or creator, QA or an admin can edit this Ticket.");
  if (isSprintClosed(ticket.sprintId)) fail(403, CLOSED);
  const before = { ...ticket, assigneeIds: [...ticket.assigneeIds] };
  const changed: string[] = [];
  // The words of a Ticket (its title and description) are edited only by the person who created it or by the Super Admin; the others who work on it change its status, assignee and priority.
  const writer = ticket.createdById === me.id || me.role === "SUPER_ADMIN";
  const wording = (data.title !== undefined && clean(data.title) !== ticket.title) || (data.description !== undefined && String(data.description ?? "") !== (ticket.description ?? ""));
  if (wording && !writer) fail(403, "Only the person who created the Ticket or the Super Admin can edit its title and description.");
  if (data.title !== undefined) {
    const title = clean(data.title);
    if (!title) fail(400, "Enter a title for the Ticket.");
    if (title !== ticket.title) {
      if (db().items.some((c) => c.id !== ticket.id && c.parentId === ticket.parentId && c.type === "TICKET" && c.title.toLowerCase() === title.toLowerCase())) fail(409, "This task already has a Ticket with that title.");
      ticket.title = title;
      changed.push("title");
    }
  }
  if (data.description !== undefined && String(data.description ?? "") !== (ticket.description ?? "")) {
    if (data.description) ticket.description = String(data.description);
    else delete ticket.description;
    changed.push("description");
  }
  if (data.priority !== undefined) {
    const priority = enumOf(data.priority, PRIORITIES, "priority");
    if (priority !== ticket.priority) {
      ticket.priority = priority;
      changed.push("priority");
    }
  }
  if (data.assigneeIds !== undefined || data.assigneeId !== undefined) {
    const ids = [...new Set([...(Array.isArray(data.assigneeIds) ? data.assigneeIds : []), ...(data.assigneeId ? [data.assigneeId] : [])].map(Number))];
    if (ids.slice().sort().join() !== ticket.assigneeIds.slice().sort().join()) {
      ticket.assigneeIds = ids;
      changed.push("assignee");
    }
  }
  checkRefs(ticket);
  if (!changed.length) return itemOut(ticket, me, true);
  touch(ticket, me);
  logActivity(ticket, `Updated ${changed.join(", ")}`, me.id);
  announce(ticket, before, me, changed);
  if (changed.includes("assignee") && ticket.assigneeIds.includes(me.id) && !before.assigneeIds.includes(me.id)) notify(ticket, "task.assigned", me, [me.id], [{ field: "Assigned", to: "you" }], "assigned this Ticket to you", { includeActor: true });
  save();
  return itemOut(ticket, me, true);
}

// ---------- Reopen ----------

/** What a completed Ticket may be reopened to. The same three for everyone who may reopen. */
const TICKET_REOPEN = ["OPEN", "IN_PROGRESS", "TESTING"];

/** Who may reopen a completed task or Ticket: the admins, QA, and the Lead of the task. The same people, whatever the kind of item. */
const canReopen = (item: DbItem, me: DbUser) => involvedInQa(me) || rootOf(item).leadId === me.id;

/**
 * Reopens a completed task or Ticket by changing its status, with the reason that every status change carries. A task goes back to the status it had before it
 * was completed (it is not reset to To Do); a Ticket goes to the status chosen from a short list. Nothing else changes: the id, title, Ticket links, history,
 * comments, images and the completion details stay, and reopening a task does not reopen its Tickets (nor a Ticket its task).
 */
export function reopen({ params, data }: Req) {
  const me = requireUser();
  const item = findItem(params.id);
  if (item.status !== "COMPLETED") fail(400, "Only a completed task or Ticket can be reopened.");
  if (!canReopen(item, me)) fail(403, "Only the task's Lead, QA or an admin can reopen this.");
  if (isSprintClosed(item.sprintId)) fail(403, CLOSED);
  const details = clean(data.details); // the reason is optional
  const target = item.type === "TICKET" ? String(data.status ?? "").toUpperCase() : (item.completedFrom && item.completedFrom !== "COMPLETED" ? item.completedFrom : "IN_PROGRESS");
  if (item.type === "TICKET" && !TICKET_REOPEN.includes(target)) fail(400, "Choose a status to reopen the Ticket to: To Do, In progress or Testing.");
  item.status = target;
  item.reopenedAt = todayISO();
  if (target === "READY_FOR_QA") item.readyForQaDate = todayISO();
  touch(item, me);
  // The permanent record: one entry per reopen, never replaced, with who did it (the signed-in account), when, from and to which status, and the reason.
  const kind = item.type === "TICKET" ? "Ticket" : "Task";
  logActivity(item, `${kind} reopened. Status changed from ${label("COMPLETED")} to ${label(target)}${details ? `: ${details}` : ""}`, me.id, {
    reopen: { kind, byId: me.id, byName: me.name, at: nowISO(), from: "COMPLETED", to: target, ...(details ? { comment: details } : {}) },
  });
  // The reopen is also a message in the conversation (always), with the same details as its history entry, so everyone reading the comments sees it.
  const when = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
  commentStatusChange(item, me, [`${kind} Reopened`, `Reopened by: ${me.name}`, `Date: ${when}`, `Previous Status: ${label("COMPLETED")}`, `Reopened Status: ${label(target)}`, `Reason: ${details || "No reason given"}`].join("\n"));
  notify(item, "task.status_changed", me, [...followers(item), ...(inQa(item) ? qaTeamIds() : [])], [{ field: "Status", from: label("COMPLETED"), to: label(target) }], details.slice(0, 480));
  save();
  return itemOut(item, me, true);
}
