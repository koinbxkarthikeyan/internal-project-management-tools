import { usersStore } from "@/lib/auth/userStore";
import type { BacklogItemData, ItemType, Priority, Sprint, Status } from "@/types/backlog";
import type { Pod, WorkEntry, WorkKind } from "@/types/work";

/**
 * Translates between the backend's shapes (numeric ids, UPPER_CASE enums, `startDate`, relation objects) and the
 * shapes the screens use (names, "In progress", `start`, comma-separated assignee names). Everything here is tolerant:
 * a relation may arrive as an object or as an id, and a missing field falls back to a sensible default.
 */

type Rec = Record<string, unknown>;
export const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);
const day = (v: unknown): string => (typeof v === "string" ? v.slice(0, 10) : "");

/** The array a list endpoint returned, whether it sent the array itself or `{ <key>: [...] }`. */
export function listFrom(data: unknown, key: string): unknown[] {
  if (Array.isArray(data)) return data;
  return list(rec(data)?.[key]);
}

// ---------- enums ----------

const norm = (v: unknown) => String(v ?? "").toUpperCase().replace(/[\s-]+/g, "_");

const STATUS: [Status, string][] = [["Open", "OPEN"], ["In progress", "IN_PROGRESS"], ["Blocked", "BLOCKED"], ["On hold", "ON_HOLD"], ["Completed", "COMPLETED"]];
const PRIORITY: [Priority, string][] = [["Critical", "CRITICAL"], ["High", "HIGH"], ["Medium", "MEDIUM"], ["Low", "LOW"], ["Not set", "NOT_SET"]];
const TYPE: [ItemType, string][] = [["Feature", "FEATURE"], ["Enhancement", "ENHANCEMENT"], ["Task", "TASK"], ["Bug", "BUG"], ["Tech Debt", "TECH_DEBT"]];
const KIND: [WorkKind, string][] = [["Backend", "BACKEND"], ["Frontend", "FRONTEND"], ["Mobile", "MOBILE"], ["Testing", "TESTING"], ["Design", "DESIGN"]];

function from<T extends string>(table: [T, string][], value: unknown, fallback: T): T {
  const v = norm(value);
  return table.find(([label, api]) => api === v || norm(label) === v)?.[0] ?? fallback;
}
const to = <T extends string>(table: [T, string][], value: T) => table.find(([label]) => label === value)?.[1];

export const statusFromApi = (v: unknown) => from(STATUS, v, "Open");
export const statusToApi = (v: Status) => to(STATUS, v) ?? "OPEN";
export const priorityFromApi = (v: unknown) => from(PRIORITY, v, "Not set");
export const priorityToApi = (v: Priority) => to(PRIORITY, v) ?? "NOT_SET";
export const typeFromApi = (v: unknown): ItemType | undefined => (v == null ? undefined : from(TYPE, v, "Task"));
export const typeToApi = (v: ItemType | undefined) => (v ? to(TYPE, v) : undefined) ?? "TASK";
export const kindFromApi = (v: unknown): WorkKind => from(KIND, v, "Backend");
// Only the kinds the backend accepts are ever sent, in its capitals. Anything else (e.g. a team name) is refused here
// instead of being sent as, or turned into, something else.
export const kindToApi = (v: WorkKind): string => {
  const api = to(KIND, v);
  if (!api) throw new Error(`"${v}" isn't a kind of work the server accepts. Choose Backend, Frontend, Mobile, Testing or Design.`);
  return api;
};

// ---------- directory ----------

/** What the mappers need to turn names into ids and back. The services fill it each time they load a list. */
export const directory = {
  owners: [] as { id: string; name: string }[],
  sprints: [] as Sprint[],
  pods: [] as Pod[],
  itemsByCode: new Map<string, BacklogItemData>(),
  itemsByApiId: new Map<number, BacklogItemData>(),
};

export const userName = (id: unknown) => usersStore.read().find((u) => u.id === String(id))?.name;
export const userIdByName = (name: string) => {
  const found = usersStore.read().find((u) => u.name.toLowerCase() === name.trim().toLowerCase());
  return found ? Number(found.id) : undefined;
};
/**
 * A task's `ownerId` is the id of an owner record (the backend's `/owners`), not of a user, so a chosen person is turned
 * into the owner record with the same name. `undefined` means that person has no owner record.
 */
export const ownerIdByName = (name: string) => {
  const found = directory.owners.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
  return found ? Number(found.id) : undefined;
};
export const sprintIdByName = (name: string) => {
  const found = directory.sprints.find((s) => s.name === name);
  return found ? Number(found.id) : undefined;
};

/** A relation field: the display name from the object, or looked up from the id the backend sent instead. */
function relName(value: unknown, id: unknown, lookup: (id: unknown) => string | undefined): string | undefined {
  const obj = rec(value);
  if (obj && text(obj.name)) return text(obj.name);
  const resolved = obj?.id ?? id ?? (typeof value === "number" || typeof value === "string" ? value : undefined);
  return resolved == null ? undefined : lookup(resolved);
}

/** A person field as the backend may send it (object with a name, plain name, or a user id): their name, or undefined when it says nothing. */
function personOf(value: unknown, id?: unknown): string | undefined {
  const obj = rec(value);
  // An object may name the person in a few ways before falling back to its id (looked up in the users).
  const named = obj ? (text(obj.name) ?? text(obj.fullName) ?? text(obj.displayName) ?? text(obj.username)) : undefined;
  return named ?? relName(value, id, userName) ?? (typeof value === "string" && value && Number.isNaN(Number(value)) ? value : undefined);
}

/** Keys of a record that point at a person (user, actor, author, ...By, ...), and are not times or the entry's own id. */
const PERSON_KEY = /(user|actor|author|person|member|employee|performer|editor|updater|modifier|creator|by)(id|name)?$/i;
const NOT_PERSON_KEY = /(^|[a-z])(at|date|time)$|^id$|^text$|^message$|^action$|^description$/i;

/**
 * The person a record (an activity entry) says did it. Any field that points at a person counts, whatever the backend calls it
 * (`user`, `actor`, `updatedBy`, `changedBy`, `author`, `userId`, `performedByName`, ...): an object or a name gives the name,
 * an id is looked up in the users. Only what the record contains is used; nothing is guessed.
 */
function personIn(entry: Rec | null): string | undefined {
  if (!entry) return undefined;
  for (const [key, value] of Object.entries(entry)) {
    if (value == null || NOT_PERSON_KEY.test(key) || !PERSON_KEY.test(key)) continue;
    const isIdKey = /id$/i.test(key) && !/by$/i.test(key);
    const found = isIdKey ? (typeof value === "number" || typeof value === "string" ? userName(value) : undefined) : personOf(value);
    if (found) return found;
  }
  return undefined;
}

/** Who last changed the task, under whichever name the backend gives that person (an object with a name, a name, or a user id). */
function lastUpdater(raw: Rec): string | undefined {
  const pick = (re: RegExp) => personIn(Object.fromEntries(Object.entries(raw).filter(([k]) => re.test(k))));
  // Fields about the last change: updatedBy, lastUpdatedBy, modifiedBy, updater, their ...Id / ...Name forms (never the creator's).
  return pick(/^(last)?(updated|modified|changed|edited)(by|user|byid|byname)?(id|name)?$|^updater/i);
}

// ---------- items ----------

/** One task from the backend as the screens use it. `codeById` resolves `carriedFromId` to the original's code. */
export function itemFromApi(raw: Rec, codeById?: ReadonlyMap<number, string>): BacklogItemData {
  const apiId = Number(raw.id);
  const owner = relName(raw.owner, raw.ownerId, (id) => directory.owners.find((o) => o.id === String(id))?.name);
  const lead = relName(raw.lead, raw.leadId, userName);
  const sprint = relName(raw.sprint, raw.sprintId, (id) => directory.sprints.find((s) => s.id === String(id))?.name);
  const pod = rec(raw.pod);
  const podId = pod?.id ?? raw.podId;

  const assigneeNames = list(raw.assignees).length
    ? list(raw.assignees).map((a) => relName(a, undefined, userName)).filter((n): n is string => !!n)
    : list(raw.assigneeIds).map((id) => userName(id)).filter((n): n is string => !!n);

  // The people as user ids too, so "mine" can be decided by id and not by a name that might be spelled differently.
  const leadUserId = rec(raw.lead)?.id ?? raw.leadId;
  const assigneeUserIds = list(raw.assignees).length
    ? list(raw.assignees).flatMap((a) => rec(a)?.userId ?? rec(rec(a)?.user)?.id ?? rec(a)?.id ?? (typeof a === "number" ? a : []))
    : list(raw.assigneeIds);

  const carriedId = raw.carriedFromId ?? rec(raw.carriedFrom)?.id;
  const carriedFrom = text(rec(raw.carriedFrom)?.code) ?? (carriedId != null ? codeById?.get(Number(carriedId)) : undefined);

  return {
    id: text(raw.code) ?? `BLG-${apiId}`,
    apiId,
    title: text(raw.title) ?? "",
    priority: priorityFromApi(raw.priority),
    status: statusFromApi(raw.status),
    owner: owner ?? "Unassigned",
    sprint: sprint ?? "Unplanned",
    ...(podId != null && podId !== "" ? { podId: String(podId) } : {}),
    comments: 0,
    deadline: day(raw.expectedDeadline),
    ...(raw.hidden ? { hidden: true } : {}),
    ...(text(raw.description) ? { description: text(raw.description) } : {}),
    ...(text(raw.notes) ? { notes: text(raw.notes) } : {}),
    ...(assigneeNames.length ? { assignees: assigneeNames.join(", ") } : {}),
    ...(lead ? { lead } : {}),
    ...(leadUserId != null ? { leadId: String(leadUserId) } : {}),
    ...(assigneeUserIds.length ? { assigneeIds: assigneeUserIds.map(String) } : {}),
    ...(raw.leadDeadline ? { leadDeadline: day(raw.leadDeadline) } : {}),
    ...(typeFromApi(raw.type) ? { type: typeFromApi(raw.type) } : {}),
    ...(raw.createdAt ? { created: day(raw.createdAt), createdAt: String(raw.createdAt) } : {}),
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
    ...(personOf(raw.createdBy, raw.createdById) ? { createdBy: personOf(raw.createdBy, raw.createdById) } : {}),
    ...(lastUpdater(raw) ? { updatedBy: lastUpdater(raw) } : {}),
    ...(raw.completedAt ? { completed: day(raw.completedAt) } : {}),
    ...(carriedFrom ? { carriedFrom } : {}),
    ...(typeof raw.canLeadEdit === "boolean" ? { canLeadEdit: raw.canLeadEdit } : {}),
    ...(typeof raw.readOnly === "boolean" ? { readOnly: raw.readOnly } : {}),
    activity: list(raw.activity).flatMap((a) => {
      const entry = rec(a);
      const message = text(entry?.text) ?? text(entry?.message) ?? text(entry?.action) ?? text(entry?.description);
      const when = entry?.createdAt ?? entry?.at ?? entry?.timestamp ?? entry?.date;
      // Keep the full timestamp only if it really carries a time; a plain date stays a plain date.
      const at = typeof when === "string" && /T\d{2}:\d{2}/.test(when) && !Number.isNaN(Date.parse(when)) ? when : undefined;
      // Who did it: whichever of the backend's person fields is present (an object with a name, a name, or a user id looked up in the users).
      const by = personIn(entry);
      return message ? [{ date: day(when), ...(at ? { at } : {}), text: message, ...(by ? { by } : {}) }] : [];
    }),
  };
}

/** Remembers the loaded tasks so codes can be turned into ids and back. */
export function rememberItems(items: BacklogItemData[]) {
  directory.itemsByCode = new Map(items.map((i) => [i.id, i]));
  directory.itemsByApiId = new Map(items.flatMap((i) => (i.apiId != null ? [[i.apiId, i] as [number, BacklogItemData]] : [])));
}

/** Adds one task (just created or re-read) to what the services remember. */
export function rememberItem(item: BacklogItemData) {
  directory.itemsByCode.set(item.id, item);
  if (item.apiId != null) directory.itemsByApiId.set(item.apiId, item);
}

export const apiIdForCode = (code: string): number | undefined => directory.itemsByCode.get(code)?.apiId;

// ---------- sprints ----------

export function sprintFromApi(raw: Rec): Sprint {
  const status = norm(raw.status);
  const closed = status === "CLOSED" || status === "COMPLETED" || raw.readOnly === true || raw.closed === true || raw.isActive === false;
  return {
    id: String(raw.id),
    name: text(raw.name) ?? `Sprint ${raw.id}`,
    start: day(raw.startDate ?? raw.start) || undefined,
    end: day(raw.endDate ?? raw.end) || undefined,
    goal: text(raw.goal) ?? "",
    podIds: [],
    status: closed ? "Closed" : status === "PAUSED" || status === "ON_HOLD" || raw.paused === true ? "Paused" : "Active",
    ...(text(raw.closedAt) ? { closedAt: text(raw.closedAt) } : {}),
  };
}

// ---------- time logs ----------

/** Names the PODs / task groups an entry covers, e.g. "Futures + Sprint tasks + Unplanned" (as the screens label it). */
export function entryLabel(tasks: BacklogItemData[]): { pod: string; podId?: string } {
  const real = tasks.find((t) => t.podId);
  const parts = [
    real ? (directory.pods.find((p) => p.id === real.podId)?.name ?? "POD") : null,
    tasks.some((t) => t.sprint !== "Unplanned" && !t.podId) ? "Sprint tasks" : null,
    tasks.some((t) => t.sprint === "Unplanned") ? "Unplanned" : null,
  ].filter(Boolean);
  return { pod: parts.join(" + ") || "Sprint tasks", ...(real?.podId ? { podId: real.podId } : {}) };
}

/** How an entry that is not on a task is saved: its description leads the note. */
export const OTHER_WORK_PREFIX = "Other work: ";

/** One time log. `fallback` supplies what the backend leaves out (e.g. the response to a save echoes little). */
export function entryFromApi(raw: Rec, fallback: Partial<WorkEntry> = {}): WorkEntry {
  const tasks: BacklogItemData[] = [];
  for (const t of list(raw.itemIds ?? raw.items ?? raw.tasks)) {
    const o = rec(t);
    const found = o ? (text(o.code) ? directory.itemsByCode.get(text(o.code)!) : directory.itemsByApiId.get(Number(o.id))) : directory.itemsByApiId.get(Number(t));
    if (found) tasks.push(found);
  }
  const itemIds = tasks.length ? tasks.map((t) => t.id) : fallback.itemIds;
  const label = tasks.length ? entryLabel(tasks) : { pod: text(raw.pod) ?? text(rec(raw.pod)?.name) ?? fallback.pod ?? "Sprint tasks", podId: fallback.podId };
  const rawNote = text(raw.note) ?? text(raw.notes);
  const other = !tasks.length && (rawNote?.startsWith(OTHER_WORK_PREFIX) || fallback.otherWork === true);
  const otherLines = other && rawNote?.startsWith(OTHER_WORK_PREFIX) ? rawNote.slice(OTHER_WORK_PREFIX.length).split("\n") : null;
  const otherTask = otherLines ? otherLines[0].trim() : (fallback.task ?? "");
  const otherNotes = otherLines ? otherLines.slice(1).join("\n").trim() : (fallback.notes ?? "");
  const person = relName(raw.person ?? raw.user, raw.userId, userName) ?? text(raw.personName) ?? fallback.person ?? "";

  return {
    id: String(raw.id),
    sprintId: String(raw.sprintId ?? rec(raw.sprint)?.id ?? fallback.sprintId ?? ""),
    person,
    ...((rec(raw.user)?.id ?? raw.userId ?? fallback.personId) != null ? { personId: String(rec(raw.user)?.id ?? raw.userId ?? fallback.personId) } : {}),
    pod: other ? "Something else" : label.pod,
    ...(label.podId ? { podId: label.podId } : {}),
    kind: raw.kind != null ? kindFromApi(raw.kind) : (fallback.kind ?? "Backend"),
    task: tasks.length ? tasks.map((t) => t.title).join(", ") : other ? otherTask : (text(raw.task) ?? fallback.task ?? ""),
    ...(other ? { otherWork: true } : itemIds ? { itemIds } : {}),
    from: day(raw.fromDate ?? raw.from) || fallback.from || "",
    to: day(raw.toDate ?? raw.to) || fallback.to || "",
    hours: Number(raw.hours ?? fallback.hours ?? 0),
    ...((other ? otherNotes : (rawNote ?? fallback.notes)) ? { notes: other ? otherNotes : (rawNote ?? fallback.notes) } : {}),
    createdAt: text(raw.createdAt) ?? fallback.createdAt ?? "",
  };
}
