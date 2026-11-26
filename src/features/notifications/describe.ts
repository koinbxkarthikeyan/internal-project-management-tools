import type { AppNotification, NotificationEventType } from "./types";

export const EVENT_LABEL: Record<NotificationEventType, string> = {
  "task.assigned": "Assigned",
  "task.reassigned": "Reassigned",
  "task.status_changed": "Status changed",
  "task.commented": "POD message",
  "task.updated": "Updated",
  "task.sprint_changed": "Sprint changed",
  "chat.message": "Direct message",
};

/** A message in a chat is one of two kinds: a direct message from one person, or a message in a POD's chat (the chat of a task or Ticket, shared by the people on it). */
export const isDirect = (n: AppNotification) => n.type === "chat.message";
export const isPod = (n: AppNotification) => n.type === "task.commented";

/** The pill's colours: sky for a direct message, violet for a POD message, grey for any other change. */
export const kindTint = (n: AppNotification) => (isDirect(n) ? "bg-sky-400/15 text-sky-700 dark:text-sky-300" : isPod(n) ? "bg-violet-400/15 text-violet-700 dark:text-violet-300" : "bg-hover text-muted");

/** One line saying what happened, built from the event's fields so the stored data stays plain. */
export function describe(n: AppNotification): string {
  const c = n.changes ?? [];
  const first = c[0];
  if (n.message) return n.message;
  switch (n.type) {
    case "task.assigned":
      return "assigned you to this task";
    case "task.reassigned":
      return "reassigned this task to you";
    case "task.status_changed":
      return first ? `changed the status from ${first.from} to ${first.to}` : "changed the status";
    case "task.commented":
      return first?.to ? `commented: \u201c${first.to}\u201d` : "commented on this task";
    case "task.sprint_changed":
      return first ? `moved it from ${first.from} to ${first.to}` : "moved it to another sprint";
    case "chat.message":
      return "sent you a message";
    case "task.updated":
      return c.length ? `updated ${c.map((x) => x.field).join(", ")}` : "updated the task";
  }
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
