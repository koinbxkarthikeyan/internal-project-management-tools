import { onExternalChange } from "@/lib/localApi";
import type { NotificationService } from "./service";
import { serverNotificationService } from "./serverService";

export const notificationService: NotificationService = serverNotificationService;

/** How often the list and count are re-read while the app is open (a change in this tab shows at once; this catches the rest). */
const REFRESH_MS = 60_000;

/**
 * Keeps the signed-in person's notifications current. They are kept in this browser: another tab of the same browser writing a
 * notification is noticed through the browser's `storage` event, and the list is also read again every minute and when the tab becomes visible.
 * Returns the way to stop.
 */
export function startNotificationTransport(userId: string): () => void {
  const refresh = () => void serverNotificationService.resync(userId).catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const offStorage = onExternalChange(() => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 200);
  });
  const interval = setInterval(refresh, REFRESH_MS);
  const onVisible = () => document.visibilityState === "visible" && refresh();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearTimeout(timer);
    clearInterval(interval);
    offStorage();
    document.removeEventListener("visibilitychange", onVisible);
  };
}
