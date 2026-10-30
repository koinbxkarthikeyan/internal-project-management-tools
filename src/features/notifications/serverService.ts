import { apiClient } from "@/lib/apiClient";
import { countOf, hasMorePages, notificationFromServer, rowsOf } from "./mapServer";
import type { Meta, NotificationFilter, NotificationService } from "./service";
import type { AppNotification } from "./types";

/**
 * WebSocket mode: the server owns the notifications. REST gives the list (20 a page, newest first), the unread count and the read state; the WebSocket only brings new ones
 * in live; this file keeps one in-memory copy per person for the bell. Nothing is saved in the browser. Endpoints (all under the API base, with the user's token):
 *
 *   GET   /notifications/unread-count
 *   GET   /notifications?page=1&limit=20            and   GET /notifications?unread=true&page=1&limit=20
 *   PATCH /notifications/:id/read
 *   POST  /notifications/read-all
 */
const PAGE_SIZE = 20;

type State = { items: AppNotification[]; unread: number; page: number; hasMore: boolean; filter: NotificationFilter; loading: boolean; error: boolean };
const states = new Map<string, State>();
const listeners = new Map<string, Set<(list: AppNotification[], meta: Meta) => void>>();

const get = (userId: string): State => states.get(userId) ?? { items: [], unread: 0, page: 0, hasMore: false, filter: "all", loading: false, error: false };
const newestFirst = (list: AppNotification[]) => [...list].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

function put(userId: string, patch: Partial<State>) {
  const next = { ...get(userId), ...patch };
  states.set(userId, next);
  listeners.get(userId)?.forEach((l) => l(next.items, { unread: next.unread, hasMore: next.hasMore, loading: next.loading, error: next.error, filter: next.filter }));
}

async function fetchCount(): Promise<number> {
  const { data } = await apiClient.get<unknown>("/notifications/unread-count");
  return countOf(data);
}

async function fetchPage(userId: string, page: number, filter: NotificationFilter) {
  const { data } = await apiClient.get<unknown>("/notifications", { params: { ...(filter === "unread" ? { unread: true } : {}), page, limit: PAGE_SIZE } });
  const rows = rowsOf(data);
  const items = rows.flatMap((r) => notificationFromServer(r, userId) ?? []);
  return { items, hasMore: hasMorePages(data, page, PAGE_SIZE, rows.length) };
}

/** Adds items to a list: the same id (or event id) is never held twice, and the newest come first. */
function merge(into: AppNotification[], more: AppNotification[]): AppNotification[] {
  const seen = new Set(into.flatMap((n) => [n.id, n.eventId]));
  return newestFirst([...into, ...more.filter((n) => !seen.has(n.id) && !seen.has(n.eventId))]);
}

export const serverNotificationService: NotificationService & {
  /** A live event from the WebSocket (already turned into a notification): added once, counted unread. */
  ingest(userId: string, n: AppNotification): void;
  /** Another device of this person read these (or everything): applied here without calling the server again. */
  applyRead(userId: string, ids: readonly string[] | "all"): void;
} = {
  async list(userId) {
    put(userId, { loading: true, filter: "all", error: false });
    try {
      const [count, first] = await Promise.all([fetchCount(), fetchPage(userId, 1, "all")]);
      put(userId, { items: merge(get(userId).items, first.items), unread: count, page: 1, hasMore: first.hasMore, loading: false, error: false });
    } catch (err) {
      put(userId, { loading: false, error: true });
      throw err;
    }
    return get(userId).items;
  },

  subscribe(userId, onChange) {
    const set = listeners.get(userId) ?? new Set();
    set.add(onChange);
    listeners.set(userId, set);
    return () => set.delete(onChange);
  },

  async loadMore(userId) {
    const s = get(userId);
    if (s.loading || !s.hasMore) return;
    put(userId, { loading: true });
    try {
      const next = await fetchPage(userId, s.page + 1, s.filter);
      put(userId, { items: merge(get(userId).items, next.items), page: s.page + 1, hasMore: next.hasMore, loading: false });
    } catch {
      put(userId, { loading: false });
    }
  },

  async setFilter(userId, filter) {
    put(userId, { filter, items: [], page: 0, hasMore: false, loading: true, error: false });
    try {
      const first = await fetchPage(userId, 1, filter);
      put(userId, { items: first.items, page: 1, hasMore: first.hasMore, loading: false });
    } catch {
      put(userId, { loading: false, error: true });
    }
  },

  /** After a (re)connect: the unread count and the first page are read again, so what happened while offline appears (and nothing appears twice). */
  async resync(userId) {
    const s = get(userId);
    let count: number;
    let first: Awaited<ReturnType<typeof fetchPage>>;
    try {
      [count, first] = await Promise.all([fetchCount(), fetchPage(userId, 1, s.filter)]);
    } catch (err) {
      put(userId, { error: s.items.length === 0 }); // a failed refresh keeps what is shown; with nothing shown it is an error state
      throw err;
    }
    // The server's copy decides what is read; a live event that arrived before this answer and is not in it yet is kept.
    const fresh = new Set(first.items.flatMap((n) => [n.id, n.eventId]));
    const extras = s.items.filter((n) => !fresh.has(n.id) && !fresh.has(n.eventId) && Date.parse(n.occurredAt) >= Date.now() - 60_000);
    const older = s.items.filter((n) => !fresh.has(n.id) && !fresh.has(n.eventId) && !extras.includes(n));
    put(userId, { items: newestFirst([...first.items, ...extras, ...older.filter((n) => first.items.length > 0 && Date.parse(n.occurredAt) < Date.parse(first.items[first.items.length - 1].occurredAt))]), unread: count, page: Math.max(1, s.page), hasMore: s.page > 1 ? s.hasMore : first.hasMore, error: false });
  },

  ingest(userId, n) {
    const s = get(userId);
    if (n.recipientId !== userId || s.items.some((x) => x.id === n.id || x.eventId === n.eventId)) return;
    put(userId, { items: [n, ...s.items], unread: n.read ? s.unread : s.unread + 1 });
  },

  applyRead(userId, ids) {
    const s = get(userId);
    const now = new Date().toISOString();
    const hit = (n: AppNotification) => !n.read && (ids === "all" || ids.includes(n.id) || ids.includes(n.eventId));
    const newlyRead = s.items.filter(hit).length;
    const updated = s.items.map((n) => (hit(n) ? { ...n, read: true, readAt: now } : n));
    put(userId, { items: s.filter === "unread" ? updated.filter((n) => !n.read) : updated, unread: ids === "all" ? 0 : Math.max(0, s.unread - newlyRead) });
  },

  async markRead(userId, id) {
    if (get(userId).items.some((n) => n.id === id && n.read)) return; // already read: nothing to ask the server
    this.applyRead(userId, [id]);
    try {
      await apiClient.patch(`/notifications/${encodeURIComponent(id)}/read`);
    } catch {
      await this.resync(userId).catch(() => undefined); // the server did not take it: show what the server says
    }
  },

  async markAllRead(userId) {
    this.applyRead(userId, "all");
    try {
      await apiClient.post("/notifications/read-all");
    } catch {
      await this.resync(userId).catch(() => undefined);
    }
  },
};
