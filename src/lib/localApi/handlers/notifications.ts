import { db, nextId, save, type DbItem, type DbNotification, type DbUser } from "../db";
import { codeOf, nowISO, num, requireUser, type Req } from "../core";
import { fail } from "../errors";

type Change = { field: string; from?: string; to?: string };

/** Tells the people a change concerns (never the person who made it). Saved with the change that caused it, by the caller. */
export function notify(item: DbItem, type: DbNotification["type"], actor: DbUser, recipients: Iterable<number | null | undefined>, changes?: Change[], message?: string, options: { includeActor?: boolean; commentId?: number } = {}) {
  const d = db();
  // The person who made the change is not told about it, except when asked to (a Ticket they created and assigned to themselves).
  const ids = new Set([...recipients].filter((id): id is number => typeof id === "number" && (options.includeActor || id !== actor.id) && d.users.some((u) => u.id === id)));
  // The same notice (same kind, item, text, change and comment) is not told again while the person still has it unread, so a repeated request never piles up copies.
  const key = (x: { type: string; taskId: number; message?: string; changes?: Change[]; commentId?: number }) => JSON.stringify([x.type, x.taskId, x.message ?? "", x.changes ?? [], x.commentId ?? null]);
  const mine = key({ type, taskId: item.id, message, changes: changes?.length ? changes : undefined, commentId: options.commentId });
  for (const recipientId of ids) {
    if (d.notifications.some((n) => n.recipientId === recipientId && !n.readAt && key(n) === mine)) continue;
    const id = nextId("notification");
    d.notifications.push({
      id,
      eventId: `n-${id}`,
      recipientId,
      type,
      taskId: item.id,
      taskCode: codeOf(item),
      taskTitle: item.title,
      actor: { id: actor.id, name: actor.name },
      occurredAt: nowISO(),
      ...(changes?.length ? { changes } : {}),
      ...(message ? { message } : {}),
      ...(options.commentId != null ? { commentId: options.commentId } : {}),
    });
  }
}

/** Everyone who follows a task: its Lead, its Assigned Users and the person who created it. */
export const followers = (item: DbItem) => [item.leadId, ...item.assigneeIds, item.createdById];

const row = (n: DbNotification) => ({
  id: String(n.id),
  eventId: n.eventId,
  type: n.type,
  taskId: String(n.taskId),
  taskCode: n.taskCode,
  taskTitle: n.taskTitle,
  actor: { id: String(n.actor.id), name: n.actor.name },
  recipientId: String(n.recipientId),
  occurredAt: n.occurredAt,
  ...(n.changes?.length ? { changes: n.changes } : {}),
  ...(n.message ? { message: n.message } : {}),
  ...(n.commentId != null ? { commentId: String(n.commentId) } : {}),
  isRead: !!n.readAt,
  ...(n.readAt ? { readAt: n.readAt } : {}),
});

const mine = (userId: number) => db().notifications.filter((n) => n.recipientId === userId);

export function unreadCount() {
  const user = requireUser();
  return { count: mine(user.id).filter((n) => !n.readAt).length };
}

export function list({ query }: Req) {
  const user = requireUser();
  const page = Math.max(1, num(query.page) ?? 1);
  const limit = Math.min(100, Math.max(1, num(query.limit) ?? 20));
  const all = mine(user.id)
    .filter((n) => !(query.unread === true || query.unread === "true") || !n.readAt)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id - a.id);
  return { items: all.slice((page - 1) * limit, page * limit).map(row), total: all.length, page, limit };
}

export function markRead({ params }: Req) {
  const user = requireUser();
  const n = mine(user.id).find((x) => String(x.id) === String(params.id));
  if (!n) fail(404, "That notification doesn't exist.");
  if (n && !n.readAt) {
    n.readAt = nowISO();
    save();
  }
  return { ok: true };
}

export function markAllRead() {
  const user = requireUser();
  const at = nowISO();
  let changed = false;
  for (const n of mine(user.id)) {
    if (n.readAt) continue;
    n.readAt = at;
    changed = true;
  }
  if (changed) save();
  return { ok: true };
}
