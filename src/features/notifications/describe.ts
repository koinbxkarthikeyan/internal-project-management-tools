import type { AppNotification, NotificationEventType } from "./types";

export const EVENT_LABEL: Record<NotificationEventType, string> = {
  "task.assigned": "Assigned",
  "task.reassigned": "Reassigned",
  "task.status_changed": "Status changed",
  "task.commented": "Comment",
  "task.updated": "Updated",
  "task.sprint_changed": "Sprint changed",
};

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
