import { NOTIFICATIONS_WS_URL } from "./config";
import { useNotificationConnection } from "./connection";
import { notificationFromServer } from "./mapServer";
import type { NotificationService } from "./service";
import { serverNotificationService } from "./serverService";
import { sessionStore } from "@/lib/auth/sessionStore";
import { notificationSocket } from "./wsClient";

export const notificationService: NotificationService = serverNotificationService;

/** How often the list and count are re-read while there is no live connection (not configured, or down). */
const FALLBACK_REFRESH_MS = 60_000;

/**
 * Starts the live side for the signed-in person and returns the way to stop it.
 *  - With a WebSocket address configured, it opens the single shared socket (calling this again for the same person reuses it), hands each live notification to the
 *    person's list after converting and checking it, and reads the count and first page again after every reconnect.
 *  - Whenever the socket is not connected (no address set, or it dropped), the count and first page are re-read from REST every minute and when the tab becomes visible,
 *    so the bell never goes stale. Nothing is simulated.
 */
export function startNotificationTransport(userId: string): () => void {
  // Notifications once simulated in this browser are not used any more; clear what an older version left behind.
  try {
    localStorage.removeItem("koinbx.mock.notifications.v1");
  } catch {
    // storage unavailable
  }
  const refresh = () => {
    if (useNotificationConnection.getState().status !== "connected") void serverNotificationService.resync(userId).catch(() => undefined);
  };
  const timer = setInterval(refresh, FALLBACK_REFRESH_MS);
  const onVisible = () => document.visibilityState === "visible" && refresh();
  document.addEventListener("visibilitychange", onVisible);

  if (NOTIFICATIONS_WS_URL) {
    notificationSocket.connect({
      url: NOTIFICATIONS_WS_URL,
      userId,
      token: sessionStore.read()?.token ?? "",
      onNotification: (payload) => {
        const n = notificationFromServer(payload, userId);
        if (n) serverNotificationService.ingest(userId, n);
      },
      onOpen: () => void serverNotificationService.resync(userId).catch(() => undefined),
      onRead: (ids) => serverNotificationService.applyRead(userId, ids),
    });
  } else {
    useNotificationConnection.getState().set("unconfigured");
  }
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    if (NOTIFICATIONS_WS_URL) notificationSocket.disconnect();
  };
}
