import { bumpRev, readDbText, state, writeDbText } from "@/lib/server/store";
import type { PasswordRecord } from "./password";

/**
 * The shared data of the app. The whole database is one JSON document on the server (see lib/server/store.ts), read once and written back after every change,
 * so every computer and browser sees the same data. It starts empty: nothing is created unless someone enters or imports it.
 * Records use the shapes the services already read (numeric ids, UPPER_CASE enums, `startDate`, ...).
 */
export type DbUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  team?: string | null;
  accessStatus: "ENABLED" | "DISABLED";
  mustChangePassword?: boolean;
  password: PasswordRecord;
  lastSignInAt?: string;
  createdAt: string;
  failedSignIns?: number;
  lockedUntil?: number;
};
export type DbOwner = { id: number; name: string; role?: string; team?: string };
export type DbPod = { id: number; name: string; hidden?: boolean };
export type DbSprint = { id: number; name: string; startDate: string; endDate: string; goal?: string; status: "ACTIVE" | "PAUSED" | "CLOSED"; closedAt?: string; createdAt: string };
/** A reopen, kept whole in the history: who (id and name at that time), when, from which status to which, and the reason if one was given. */
export type DbReopen = { kind: "Task" | "Ticket"; byId: number; byName: string; at: string; from: string; to: string; comment?: string };
export type DbActivity = { id: number; text: string; createdAt: string; userId?: number; reopen?: DbReopen };
export type DbItem = {
  id: number;
  title: string;
  description?: string;
  notes?: string;
  priority: string;
  type: string;
  status: string;
  ownerId?: number | null;
  sprintId?: number | null;
  podId?: number | null;
  leadId?: number | null;
  assigneeIds: number[];
  expectedDeadline?: string | null;
  leadDeadline?: string | null;
  /** The day the task last entered Ready for QA, recorded by the app (never typed in). Kept when the task moves on or back. */
  readyForQaDate?: string | null;
  completedAt?: string | null;
  /** The day a completed task was last reopened by changing its status. The completion date is kept. */
  reopenedAt?: string | null;
  /** The status the task had just before it was completed: what a Reopen goes back to. */
  completedFrom?: string | null;
  hidden?: boolean;
  parentId?: number | null;
  /** The code shown to people. Tickets are TKT-001, TKT-002, ...; every other task is BLG-<id>. */
  code?: string;
  carriedFromId?: number | null;
  historySprintIds: (number | null)[];
  createdAt: string;
  updatedAt: string;
  createdById?: number;
  /** The creator's team as it was when they created this (kept as it was; their profile may change later). */
  createdByTeam?: string | null;
  updatedById?: number;
  activity: DbActivity[];
};
export type DbEntry = { id: number; sprintId: number; userId: number; itemIds: number[]; note?: string; kind: string; fromDate: string; toDate: string; hours: number; createdAt: string };
/** An image attached to a Ticket: its details only. The file itself is in the image store (blobStore.ts) under the same id. */
export type DbAttachment = { id: number; itemId: number; taskId: number; name: string; type: string; size: number; originalSize?: number; createdAt: string; userId: number; /** Set when the image belongs to a comment (shown in it), not to the Ticket's own attachments. */ commentId?: number };
/** `team` is the author's team when they wrote it; `updatedAt` is set when the author edited it. */
export type DbComment = { id: number; itemId: number; userId: number; text: string; createdAt: string; team?: string | null; updatedAt?: string; /** The people @mentioned in it (by user id). */ mentionIds?: number[]; /** Set on the note "created Ticket …" that a new Ticket leaves on its task: the Ticket it points to. */ ticketId?: number };
export type DbNotification = {
  id: number;
  eventId: string;
  recipientId: number;
  type: string;
  taskId: number;
  taskCode: string;
  taskTitle: string;
  actor: { id: number; name: string };
  occurredAt: string;
  changes?: { field: string; from?: string; to?: string }[];
  message?: string;
  /** For a comment notice: the comment, so the notice opens at it. */
  commentId?: number;
  readAt?: string;
};

export type Db = {
  version: 1;
  seq: Record<"user" | "owner" | "pod" | "sprint" | "item" | "entry" | "comment" | "notification" | "activity" | "ticket" | "attachment", number>;
  users: DbUser[];
  owners: DbOwner[];
  pods: DbPod[];
  sprints: DbSprint[];
  items: DbItem[];
  entries: DbEntry[];
  comments: DbComment[];
  notifications: DbNotification[];
  attachments: DbAttachment[];
};

const empty = (): Db => ({
  version: 1,
  seq: { user: 0, owner: 0, pod: 0, sprint: 0, item: 0, entry: 0, comment: 0, notification: 0, activity: 0, ticket: 0, attachment: 0 },
  users: [],
  owners: [],
  pods: [],
  sprints: [],
  items: [],
  entries: [],
  comments: [],
  notifications: [],
  attachments: [],
});

/** The database, kept in memory after it is read from the file. Callers change it in place and then call `save()`. */
export function db(): Db {
  const s = state();
  if (s.cache) return s.cache as Db;
  let loaded: Db;
  try {
    const text = readDbText();
    const parsed = text ? (JSON.parse(text) as Db) : null;
    loaded = parsed && parsed.version === 1 ? { ...empty(), ...parsed, seq: { ...empty().seq, ...parsed.seq } } : empty();
  } catch (err) {
    // A damaged file is never replaced by an empty database: the server stops here and the file is kept for repair.
    throw new Error(`The data file could not be read (${err instanceof Error ? err.message : "unknown error"}). It was left untouched.`);
  }
  s.cache = loaded;
  return loaded;
}

/** Writes the database back (atomically) and tells the other computers something changed. */
export function save(): void {
  writeDbText(JSON.stringify(state().cache ?? db()));
  bumpRev();
}

/** Replaces the whole database (restoring a backup, or importing the data of a browser). The caller has already checked its shape. */
export function replaceDb(next: Db): void {
  state().cache = next;
  save();
}

/** Throws away changes made in memory that were not saved, so a refused request leaves no half-applied change behind (the next read starts from the file). */
export function discard(): void {
  state().cache = null;
}

export const nextId = (kind: keyof Db["seq"]): number => ++db().seq[kind];
