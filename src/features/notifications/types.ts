/**
 * The notification data model the bell uses. The server's notifications are converted to these shapes in mapServer.ts, so the screens never depend on the server's own field names.
 */
export const NOTIFICATION_EVENT_TYPES = ["task.assigned", "task.reassigned", "task.status_changed", "task.commented", "task.updated", "task.sprint_changed"] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export type NotificationActor = { id: string; name: string };

/** One thing that changed, shown to the person (values are display text, e.g. "To Do", "Sprint 6"). */
export type NotificationChange = { field: string; from?: string; to?: string };

/** What arrives from the source: one event for one recipient. */
export type NotificationEvent = {
  /** Unique per event; a repeated delivery with the same id is ignored. */
  eventId: string;
  type: NotificationEventType;
  /** The backend's numeric id as text, or the task code when there is none. */
  taskId: string;
  /** The task code shown to people (e.g. BLG-12). */
  taskCode: string;
  taskTitle: string;
  actor: NotificationActor;
  recipientId: string;
  /** ISO time of the change. */
  occurredAt: string;
  changes?: NotificationChange[];
  /** An optional ready-made sentence from the sender; the screen builds its own from the type and changes when it is absent. */
  message?: string;
};

/** A notification as the bell shows it. */
export type AppNotification = NotificationEvent & {
  /** The server's own id for the notification: what is sent to mark it read, and what live and listed copies are matched on. */
  id: string;
  read: boolean;
  readAt?: string;
};
