import { serverNotificationService } from "@/features/notifications/serverService";
import { useMyTasksStore } from "@/stores/myTasksStore";

/**
 * After a Ticket was created, assigned or reassigned: the signed-in person's My Task lists (and so the count of Tickets assigned to them) and their notifications
 * are read again at once, so the bell and the count change without a refresh. Other people's tabs pick the change up through the browser's `storage` event.
 */
export function refreshTicketViews(userId: string): void {
  void useMyTasksStore.getState().load(userId, true);
  void serverNotificationService.resync(userId).catch(() => undefined);
}
