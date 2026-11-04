import { db, nextId, save, type DbEntry, type DbUser } from "../db";
import { clean, isAdminUser, isSprintClosed, nowISO, requireUser, userRef, type Req, type Rec } from "../core";
import { fail } from "../errors";

const MAX_DAILY_SPAN_HOURS = 24 * 31;

const out = (e: DbEntry): Rec => ({
  id: e.id,
  sprintId: e.sprintId,
  userId: e.userId,
  ...(userRef(e.userId) ? { user: userRef(e.userId) } : {}),
  itemIds: e.itemIds,
  ...(e.note ? { note: e.note } : {}),
  kind: e.kind,
  fromDate: e.fromDate,
  toDate: e.toDate,
  hours: e.hours,
  createdAt: e.createdAt,
});

const sprintOrFail = (id: unknown) => {
  const s = db().sprints.find((x) => x.id === Number(id));
  if (!s) fail(404, "That sprint doesn't exist.");
  return s as NonNullable<typeof s>;
};

const day = (v: unknown, what: string): string => {
  const s = String(v ?? "").slice(0, 10);
  if (!s || Number.isNaN(Date.parse(s))) fail(400, `Enter a valid ${what} date.`);
  return s;
};

function read(data: Rec, base?: DbEntry) {
  const fromDate = data.fromDate !== undefined ? day(data.fromDate, "start") : base?.fromDate;
  const toDate = data.toDate !== undefined ? day(data.toDate, "end") : base?.toDate;
  if (!fromDate || !toDate) fail(400, "Enter the dates the work covers.");
  if ((fromDate as string) > (toDate as string)) fail(400, "The end date can't be before the start date.");
  const hours = data.hours !== undefined ? Number(data.hours) : base?.hours;
  if (hours === undefined || !Number.isFinite(hours) || hours <= 0 || hours > MAX_DAILY_SPAN_HOURS) fail(400, "Enter the hours worked (more than 0).");
  const kind = data.kind !== undefined ? clean(data.kind) : base?.kind;
  if (!kind) fail(400, "Choose a kind of work.");
  const itemIds = Array.isArray(data.itemIds) ? [...new Set(data.itemIds.map(Number))] : (base?.itemIds ?? []);
  if (itemIds.some((id) => !db().items.some((i) => i.id === id))) fail(400, "One of the tasks doesn't exist.");
  const note = data.note !== undefined ? String(data.note ?? "").trim() : base?.note;
  if (!itemIds.length && !note) fail(400, "Pick a task or describe the work.");
  return { fromDate: fromDate as string, toDate: toDate as string, hours: hours as number, kind: kind as string, itemIds, ...(note ? { note } : {}) };
}

export function mySprint({ query }: Req) {
  const me = requireUser();
  const sprint = sprintOrFail(query.sprintId);
  const entries = db().entries.filter((e) => e.sprintId === sprint.id && e.userId === me.id).sort((a, b) => b.id - a.id);
  return { entries: entries.map(out), totalHours: entries.reduce((s, e) => s + e.hours, 0) };
}

/** Everyone's time logs in a sprint, grouped by person. For Super Admin and enabled Admins only. */
export function everyone({ query }: Req) {
  const me = requireUser();
  if (!isAdminUser(me)) fail(403, "Only a Super Admin or an enabled Admin can see everyone's work.");
  const sprint = sprintOrFail(query.sprintId);
  const rows = db().entries.filter((e) => e.sprintId === sprint.id);
  const people = [...new Set(rows.map((e) => e.userId))].flatMap((id) => userRef(id) ?? []);
  return {
    byPerson: people.map((p) => {
      const mine = rows.filter((e) => e.userId === p.id).sort((a, b) => b.id - a.id);
      return { person: p, entries: mine.map(out), totalHours: mine.reduce((s, e) => s + e.hours, 0) };
    }),
    totalHours: rows.reduce((s, e) => s + e.hours, 0),
  };
}

export function create({ data }: Req) {
  const me = requireUser();
  const sprint = sprintOrFail(data.sprintId);
  if (isSprintClosed(sprint.id)) fail(400, "That sprint is closed, so no more work can be logged in it.");
  const entry: DbEntry = { id: nextId("entry"), sprintId: sprint.id, userId: me.id, ...read(data), createdAt: nowISO() };
  db().entries.push(entry);
  save();
  return out(entry);
}

function own(id: unknown, me: DbUser): DbEntry {
  const entry = db().entries.find((e) => e.id === Number(id));
  if (!entry) fail(404, "That entry doesn't exist.");
  const e = entry as DbEntry;
  if (e.userId !== me.id && !isAdminUser(me)) fail(403, "You can only change your own entries.");
  if (isSprintClosed(e.sprintId)) fail(400, "That sprint is closed, so its entries can only be viewed.");
  return e;
}

export function update({ params, data }: Req) {
  const me = requireUser();
  const entry = own(params.id, me);
  Object.assign(entry, read(data, entry));
  if (data.note !== undefined && !String(data.note ?? "").trim()) delete entry.note;
  save();
  return out(entry);
}

export function remove({ params }: Req) {
  const me = requireUser();
  const entry = own(params.id, me);
  db().entries = db().entries.filter((e) => e.id !== entry.id);
  save();
  return null;
}

