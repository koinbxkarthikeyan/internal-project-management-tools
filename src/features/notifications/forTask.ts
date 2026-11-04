import type { BacklogItemData } from "@/types/backlog";
import type { AppNotification } from "./types";

/** The unread notices about a task: about the task itself or about any Ticket under it (a new Ticket for someone, a mention, a status change). It follows the notices, so reading one lowers it at once. */
export function unreadNoticesForTask(notices: readonly AppNotification[], task: Pick<BacklogItemData, "id" | "ticketStats">): AppNotification[] {
  const codes = new Set([task.id, ...(task.ticketStats?.codes ?? [])]);
  return notices.filter((n) => !n.read && codes.has(n.taskCode));
}

export const unreadForTask = (notices: readonly AppNotification[], task: Pick<BacklogItemData, "id" | "ticketStats">): number => unreadNoticesForTask(notices, task).length;
