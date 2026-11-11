import { create } from "zustand";
import { notificationService } from ".";
import type { NotificationFilter } from "./service";
import type { AppNotification } from "./types";

type State = {
  userId: string;
  items: AppNotification[];
  /** The server's unread count (what the badge shows); it can be larger than what is loaded. */
  unread: number;
  hasMore: boolean;
  loading: boolean;
  /** The server could not be reached and there is nothing to show. */
  error: boolean;
  filter: NotificationFilter;
  /** Starts following this person's notifications; returns the way to stop. Calling it again for another person switches over. */
  start: (userId: string) => () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  loadMore: () => void;
  setFilter: (filter: NotificationFilter) => void;
  /** Reads the count and first page again (the Try again button). */
  reload: () => void;
};

const EMPTY = { userId: "", items: [], unread: 0, hasMore: false, loading: false, error: false, filter: "all" as NotificationFilter };

/** The signed-in person's notifications, as the server has them. Nothing is kept in the browser. */
export const useNotificationStore = create<State>((set, get) => ({
  ...EMPTY,

  start: (userId) => {
    set({ ...EMPTY, userId, loading: true });
    let live = true;
    const stop = notificationService.subscribe(userId, (items, meta) => {
      if (live) set({ items, unread: meta.unread, hasMore: meta.hasMore, loading: meta.loading, error: meta.error, filter: meta.filter });
    });
    // The first page and the unread count: the service reports the result (or the failure) through the subscription.
    void notificationService.list(userId).catch(() => undefined);
    return () => {
      live = false;
      stop();
      if (get().userId === userId) set({ ...EMPTY });
    };
  },

  markRead: (id) => {
    const { userId, items } = get();
    if (userId && items.some((n) => n.id === id && !n.read)) void notificationService.markRead(userId, id);
  },

  markAllRead: () => {
    const { userId, unread } = get();
    if (userId && unread > 0) void notificationService.markAllRead(userId);
  },

  loadMore: () => {
    const { userId, hasMore, loading } = get();
    if (userId && hasMore && !loading) void notificationService.loadMore(userId);
  },

  setFilter: (filter) => {
    const { userId } = get();
    if (userId) void notificationService.setFilter(userId, filter);
  },

  reload: () => {
    const { userId } = get();
    if (!userId) return;
    set({ loading: true, error: false });
    void notificationService.list(userId).catch(() => undefined);
  },
}));

export const selectUnread = (s: State) => s.unread;
