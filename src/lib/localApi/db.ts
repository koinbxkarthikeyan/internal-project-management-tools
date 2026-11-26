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
export type DbSprint = { id: number; name: string; startDate: string; endDate: string; goal?: string; status: "ACTIVE" | "PAUSED" | "CLOSED"; closedAt?: string; createdAt: string; /** Company holidays: 0 hours for everyone. */ commonLeaves?: { date: string; description: string }[] };
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
/** One person's own leave day in a sprint (`hours` absent = the whole day). */
export type DbLeave = { id: number; sprintId: number; userId: number; date: string; hours?: number };
/**
 * One line of the audit log: who (the signed-in person at the time, by id and by the name they had), what (`action`, a short code such as "user.role_changed"), to what (`target`, in
 * words) and when. `detail` says how it changed ("User → Admin"). It never holds a password, a hash or a token.
 */
export type DbAudit = { id: number; at: string; actorId: number | null; actorName: string; action: string; target: string; detail?: string };
export type DbEntry = { id: number; sprintId: number; userId: number; itemIds: number[]; note?: string; kind: string; fromDate: string; toDate: string; hours: number; createdAt: string };
/** An image attached to a Ticket: its details only. The file itself is in the image store (blobStore.ts) under the same id. */
export type DbAttachment = { id: number; itemId: number; taskId: number; name: string; type: string; size: number; originalSize?: number; createdAt: string; userId: number; /** Set when the image belongs to a comment (shown in it), not to the Ticket's own attachments. */ commentId?: number };
/** `team` is the author's team when they wrote it; `updatedAt` is set when the author edited it. */
export type DbComment = { id: number; itemId: number; userId: number; text: string; createdAt: string; team?: string | null; updatedAt?: string; /** The people @mentioned in it (by user id). */ mentionIds?: number[]; /** Set on the note "created Ticket …" that a new Ticket leaves on its task: the Ticket it points to. */ ticketId?: number; /** What kind of message: text (the default), image, video, audio (a voice message), code or file. */ kind?: "text" | "image" | "video" | "audio" | "code" | "file"; /** The language of a code message. */ lang?: string; /** The message this one replies to. */ replyTo?: number; /** Reactions: emoji → the people who gave it. */ reactions?: Record<string, number[]>; /** Set when the author changed the words. */ editedAt?: string; /** Deleted: the message stays in the conversation as "This message was deleted" and its words and images are gone. */ deleted?: boolean };
/**
 * A chat message. A direct message to one person (`toId`). A POD's chat has no messages of its own: it is the task's comments.
 */
export type DbMessage = { id: number; fromId: number; text: string; createdAt: string; toId: number; /** What kind of message: text (the default), image, video, audio (a voice message), code or file. */ kind?: "text" | "image" | "video" | "audio" | "code" | "file"; /** The language of a code message. */ lang?: string; /** The message this one replies to. */ replyTo?: number; /** Reactions: emoji → the people who gave it. */ reactions?: Record<string, number[]>; /** Set when the author changed the words. */ editedAt?: string; /** Deleted for everyone: the message stays in the chat as "This message was deleted" and its words are gone. */ deleted?: boolean };
/** A file sent in a chat message (its bytes are in the file store under the same id; only the details are here). `ref` says where it belongs once the message exists. */
export type DbChatFile = { id: number; userId: number; name: string; type: string; size: number; kind: "image" | "video" | "audio" | "file"; /** Seconds, for a voice message or a video, as the sender's browser measured it. */ duration?: number; createdAt: string; /** A direct chat: the two people. */ members?: number[]; /** A group chat: the task whose chat it is. */ itemId?: number; /** The message it was sent with ("dm": a direct message, "comment": a group message), once sent. */ ref?: { type: "dm" | "comment"; id: number } };
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
  seq: Record<"user" | "owner" | "pod" | "sprint" | "item" | "entry" | "comment" | "notification" | "activity" | "ticket" | "attachment" | "leave" | "audit" | "message", number>;
  users: DbUser[];
  owners: DbOwner[];
  pods: DbPod[];
  sprints: DbSprint[];
  items: DbItem[];
  entries: DbEntry[];
  leaves: DbLeave[];
  /** The audit log, oldest first (see lib/localApi/audit.ts). */
  audit: DbAudit[];
  comments: DbComment[];
  notifications: DbNotification[];
  attachments: DbAttachment[];
  messages: DbMessage[];
  /** The newest message each person has read, by person id then by conversation ("task:<task id>" or "dm:<other id>"). */
  chatReads: Record<string, Record<string, number>>;
  /** The messages each person deleted for themselves only, by person id then by conversation. */
  chatHidden: Record<string, Record<string, number[]>>;
  chatFiles: DbChatFile[];
};

const empty = (): Db => ({
  version: 1,
  seq: { user: 0, owner: 0, pod: 0, sprint: 0, item: 0, entry: 0, comment: 0, notification: 0, activity: 0, ticket: 0, attachment: 0, leave: 0, audit: 0, message: 0 },
  users: [],
  owners: [],
  pods: [],
  sprints: [],
  items: [],
  entries: [],
  leaves: [],
  audit: [],
  comments: [],
  notifications: [],
  attachments: [],
  messages: [],
  chatReads: {},
  chatHidden: {},
  chatFiles: [],
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
  // A file made before the audit log existed has none; the log is never missing.
  next.audit ??= [];
  next.messages ??= [];
  next.chatReads ??= {};
  next.chatHidden ??= {};
  next.chatFiles ??= [];
  next.seq = { ...empty().seq, ...next.seq };
  state().cache = next;
  save();
}

/** Throws away changes made in memory that were not saved, so a refused request leaves no half-applied change behind (the next read starts from the file). */
export function discard(): void {
  state().cache = null;
}

export const nextId = (kind: keyof Db["seq"]): number => ++db().seq[kind];
