import { NOTIFICATION_EVENT_TYPES, type AppNotification, type NotificationActor, type NotificationChange, type NotificationEventType } from "./types";
import { parseNotificationEvent } from "./validate";

/**
 * Turns what the notification server sends (REST rows and WebSocket payloads) into the shape the bell uses. The server's own field names are not fixed by this
 * app, so the common spellings are accepted: a notification that already follows docs/backend-notifications.md is taken as it is, and anything else is read
 * field by field (`id`, `type`, `title` / `message`, `taskId`, `task: { id, code, title }`, `isRead` / `readAt`, `createdAt`, `actor`...). A row with no usable id is dropped.
 * The text the server wrote (`message` or `title`) is shown as it is.
 */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : typeof v === "number" ? String(v) : undefined);
const pick = (r: Rec, ...keys: string[]): unknown => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null);

const KINDS: Record<string, NotificationEventType> = {
  assigned: "task.assigned",
  assignment: "task.assigned",
  reassigned: "task.reassigned",
  status_changed: "task.status_changed",
  status: "task.status_changed",
  commented: "task.commented",
  comment: "task.commented",
  updated: "task.updated",
  sprint_changed: "task.sprint_changed",
};

function typeOf(raw: unknown): NotificationEventType {
  const s = (str(raw) ?? "").toLowerCase().replace(/[\s.-]+/g, "_").replace(/^task_/, "");
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(`task.${s}`) ? (`task.${s}` as NotificationEventType) : (KINDS[s] ?? "task.updated");
}

/** One server row or payload as a notification, or null when it has no id. `userId` is who is signed in (the recipient when the row does not say). */
export function notificationFromServer(raw: unknown, userId: string): AppNotification | null {
  if (!isRec(raw)) return null;
  const strict = parseNotificationEvent(raw);
  const readAt = str(pick(raw, "readAt", "read_at"));
  const read = typeof pick(raw, "isRead", "is_read", "read") === "boolean" ? (pick(raw, "isRead", "is_read", "read") as boolean) : !!readAt;
  if (strict) {
    const id = str(raw.id) ?? strict.eventId;
    return { ...strict, id, read, ...(readAt ? { readAt } : {}) };
  }

  const id = str(pick(raw, "id", "notificationId", "_id"));
  if (!id) return null;
  const task = isRec(raw.task) ? raw.task : isRec(raw.item) ? raw.item : ({} as Rec);
  const taskId = str(pick(raw, "taskId", "itemId", "entityId")) ?? str(task.id) ?? "";
  const taskCode = str(pick(raw, "taskCode", "itemCode")) ?? str(task.code) ?? (taskId ? `BLG-${taskId}` : "");
  const a = pick(raw, "actor", "sender", "triggeredBy", "createdBy");
  const actor: NotificationActor = isRec(a)
    ? { id: str(a.id) ?? "", name: str(a.name) ?? str(a.fullName) ?? "Someone" }
    : { id: str(pick(raw, "actorId", "senderId")) ?? "", name: str(pick(raw, "actorName", "senderName")) ?? "Someone" };
  const when = str(pick(raw, "createdAt", "created_at", "occurredAt", "timestamp")) ?? "";
  const changes = Array.isArray(raw.changes) ? (raw.changes.filter((c): c is NotificationChange => isRec(c) && typeof c.field === "string") as NotificationChange[]) : undefined;
  const text = str(pick(raw, "message", "body", "description")) ?? str(raw.title);

  return {
    id,
    eventId: str(raw.eventId) ?? id,
    type: typeOf(pick(raw, "type", "event", "kind")),
    taskId,
    taskCode: taskCode || "–",
    taskTitle: str(pick(raw, "taskTitle")) ?? str(task.title) ?? (str(raw.title) && text !== str(raw.title) ? str(raw.title)! : ""),
    actor,
    recipientId: str(pick(raw, "recipientId", "userId")) ?? userId,
    occurredAt: Number.isNaN(Date.parse(when)) ? new Date().toISOString() : when,
    ...(changes?.length ? { changes } : {}),
    ...(text ? { message: text } : {}),
    read,
    ...(readAt ? { readAt } : {}),
  };
}

/** The list of rows in a REST answer, whichever way it is wrapped (`items`, `data`, `notifications`, `rows`, `results`, or a bare array). */
export function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRec(data)) return [];
  for (const k of ["items", "data", "notifications", "rows", "results"]) {
    const v = data[k];
    if (Array.isArray(v)) return v;
    if (isRec(v)) return rowsOf(v);
  }
  return [];
}

/** The number in an unread-count answer (`{ count }`, `{ unreadCount }`, `{ unread }`, `{ data: ... }` or a bare number). */
export function countOf(data: unknown): number {
  if (typeof data === "number") return Math.max(0, Math.floor(data));
  if (!isRec(data)) return 0;
  const v = pick(data, "unreadCount", "count", "unread", "total");
  if (typeof v === "number") return Math.max(0, Math.floor(v));
  return isRec(data.data) || typeof data.data === "number" ? countOf(data.data) : 0;
}

/** Whether another page exists: the server's own paging fields when it sends them, otherwise a full page means there may be more. */
export function hasMorePages(data: unknown, page: number, limit: number, received: number): boolean {
  const root = isRec(data) ? data : {};
  const meta = isRec(root.meta) ? root.meta : isRec(root.pagination) ? root.pagination : root;
  if (typeof meta.hasNext === "boolean") return meta.hasNext;
  if (typeof meta.hasMore === "boolean") return meta.hasMore;
  const pages = pick(meta, "totalPages", "pages", "pageCount");
  if (typeof pages === "number") return page < pages;
  const total = pick(meta, "total", "totalItems", "totalCount");
  if (typeof total === "number") return page * limit < total;
  return received >= limit;
}
