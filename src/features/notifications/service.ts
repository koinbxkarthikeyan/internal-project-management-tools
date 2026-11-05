import type { AppNotification } from "./types";

export type Unsubscribe = () => void;
export type NotificationFilter = "all" | "unread";

/** What a list carries besides its items: the real unread total (not just what is loaded), whether more pages exist, and what is shown. */
export type Meta = { unread: number; hasMore: boolean; loading: boolean; error: boolean; filter: NotificationFilter };

/** What the screens use. The one implementation is `serverService.ts` (the backend's REST API, with live additions from the WebSocket). */
export interface NotificationService {
  /** The person's notifications, newest first (the first page); rejects when the server cannot be reached. */
  list(userId: string): Promise<AppNotification[]>;
  /** Called with the person's list and its meta whenever either changes. Returns the way to stop. */
  subscribe(userId: string, onChange: (list: AppNotification[], meta: Meta) => void): Unsubscribe;
  loadMore(userId: string): Promise<void>;
  /** Shows all notifications or only the unread ones (asked of the server). */
  setFilter(userId: string, filter: NotificationFilter): Promise<void>;
  /** Reads the count and first page again (after a reconnect, on a timer, or on Try again). */
  resync(userId: string): Promise<void>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}
