import { NOTIFICATION_EVENT_TYPES, type NotificationChange, type NotificationEvent } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" && v.length <= max ? v : null);

/**
 * Checks a notification event from outside (a WebSocket message, or anything not built here) and returns a clean copy, or null when it is not valid.
 * Only known fields are kept, so unexpected data never reaches the notification list. This is a shape check: who may receive an event is the server's job.
 */
export function parseNotificationEvent(raw: unknown): NotificationEvent | null {
  if (!isObject(raw)) return null;
  const eventId = text(raw.eventId, 200);
  const taskId = text(raw.taskId, 100);
  const taskCode = text(raw.taskCode, 60);
  const recipientId = text(raw.recipientId, 100);
  const taskTitle = typeof raw.taskTitle === "string" && raw.taskTitle.length <= 500 ? raw.taskTitle : null;
  const type = NOTIFICATION_EVENT_TYPES.find((t) => t === raw.type);
  const actor = isObject(raw.actor) ? { id: text(raw.actor.id, 100), name: text(raw.actor.name, 200) } : null;
  const occurredAt = typeof raw.occurredAt === "string" && !Number.isNaN(Date.parse(raw.occurredAt)) ? raw.occurredAt : null;
  if (!eventId || !taskId || !taskCode || !recipientId || taskTitle === null || !type || !actor?.id || !actor.name || !occurredAt) return null;

  let changes: NotificationChange[] | undefined;
  if (raw.changes !== undefined) {
    if (!Array.isArray(raw.changes) || raw.changes.length > 20) return null;
    changes = [];
    for (const c of raw.changes) {
      if (!isObject(c)) return null;
      const field = text(c.field, 100);
      if (!field || (c.from !== undefined && typeof c.from !== "string") || (c.to !== undefined && typeof c.to !== "string")) return null;
      changes.push({ field, ...(c.from !== undefined ? { from: String(c.from).slice(0, 300) } : {}), ...(c.to !== undefined ? { to: String(c.to).slice(0, 300) } : {}) });
    }
  }
  const message = typeof raw.message === "string" && raw.message.length <= 500 ? raw.message : undefined;
  return { eventId, type, taskId, taskCode, taskTitle, actor: { id: actor.id, name: actor.name }, recipientId, occurredAt, ...(changes?.length ? { changes } : {}), ...(message ? { message } : {}) };
}
