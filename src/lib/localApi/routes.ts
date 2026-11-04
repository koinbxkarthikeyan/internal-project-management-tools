import { discard } from "./db";
import * as backup from "./backup";
import { LocalApiError } from "./errors";
import type { Req, Rec } from "./core";
import * as attachments from "./handlers/attachments";
import * as bulk from "./handlers/bulk";
import * as comments from "./handlers/comments";
import * as dir from "./handlers/directory";
import * as items from "./handlers/items";
import * as notifications from "./handlers/notifications";
import * as sprints from "./handlers/sprints";
import * as users from "./handlers/users";
import * as work from "./handlers/work";


export type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Handler = (req: Req) => unknown | Promise<unknown>;

/**
 * Every request the screens make is answered here, on the server, from the shared data (the page reaches it through /api/rpc, see lib/remote.ts). The routes keep the
 * shape the services were written for (paths, bodies, answers), so the screens, forms and validation are the ones they always were.
 */
const ROUTES: [Method, string, Handler][] = [
  ["GET", "/auth/setup-status", users.setupStatus],
  ["POST", "/auth/setup", users.setup],
  ["POST", "/auth/sign-in", users.signIn],
  ["POST", "/auth/sign-in/password", users.signInWithPassword],
  ["GET", "/auth/me", users.me],
  ["POST", "/auth/change-password", users.changePassword],

  ["GET", "/users/options", users.listOptions],
  ["GET", "/users", users.list],
  ["POST", "/users", users.create],
  ["PATCH", "/users/:id/access", users.access],
  ["PATCH", "/users/:id", users.update],
  ["DELETE", "/users/:id", users.remove],

  ["GET", "/owners", dir.listOwners],
  ["POST", "/owners", dir.createOwner],
  ["PATCH", "/owners/:id", dir.updateOwner],
  ["DELETE", "/owners/:id", dir.deleteOwner],

  ["GET", "/pods", dir.listPods],
  ["POST", "/pods", dir.createPod],
  ["PATCH", "/pods/:id", dir.updatePod],

  ["GET", "/sprints", sprints.list],
  ["POST", "/sprints", sprints.create],
  ["POST", "/sprints/:id/close", sprints.close],
  ["POST", "/sprints/:id/start", sprints.start],
  ["PATCH", "/sprints/:id", sprints.update],
  ["DELETE", "/sprints/:id", sprints.remove],

  ["GET", "/items/mine", items.mine],
  ["GET", "/items/qa", items.qaQueue],
  ["GET", "/items", items.list],
  ["POST", "/items", items.create],
  ["GET", "/items/:id/comments", comments.list],
  ["POST", "/items/:id/comments", comments.create],
  ["GET", "/items/:id/attachments", attachments.list],
  ["POST", "/items/:id/attachments", attachments.add],
  ["DELETE", "/attachments/:id", attachments.remove],
  ["GET", "/items/:id/tickets", items.tickets],
  ["POST", "/items/:id/tickets", items.createTicket],
  ["PATCH", "/items/:id/ticket", items.editTicket],
  ["PATCH", "/items/:id/visibility", items.setVisibility],
  ["PATCH", "/items/:id/lead", items.leadUpdate],
  ["PATCH", "/items/:id/status", items.changeStatus],
  ["POST", "/items/:id/reopen", items.reopen],
  ["GET", "/items/:id", items.get],
  ["PATCH", "/items/:id", items.update],
  ["DELETE", "/items/hidden", items.removeHidden],
  ["DELETE", "/items/:id", items.remove],
  ["PATCH", "/comments/:id", comments.edit],
  ["DELETE", "/comments/:id", comments.remove],

  ["GET", "/work-entries/my-sprint", work.mySprint],
  ["GET", "/work-entries/everyone", work.everyone],
  ["POST", "/work-entries", work.create],
  ["PATCH", "/work-entries/:id", work.update],
  ["DELETE", "/work-entries/:id", work.remove],

  ["GET", "/notifications/unread-count", notifications.unreadCount],
  ["GET", "/notifications", notifications.list],
  ["POST", "/notifications/read-all", notifications.markAllRead],
  ["PATCH", "/notifications/:id/read", notifications.markRead],

  ["POST", "/bulk/backlog", bulk.backlog],
  ["POST", "/bulk/owners", bulk.owners],
  ["POST", "/bulk/users", bulk.users],

  ["GET", "/backup/export", () => backup.exportDatabase()],
  ["POST", "/backup/check", ({ data }) => ({ summary: backup.readBackup(String(data.text ?? "")).summary })],
  ["POST", "/backup/restore", ({ data }) => backup.restoreDatabase(String(data.text ?? ""))],
];

const compiled = ROUTES.map(([method, path, handler]) => ({
  method,
  names: [...path.matchAll(/:(\w+)/g)].map((m) => m[1]),
  pattern: new RegExp(`^${path.replace(/:\w+/g, "([^/]+)")}$`),
  handler,
}));

/** A copy of a value that no longer shares anything with the stored data, so a screen can never change the database by editing an answer. */
const detach = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export async function dispatch<T = unknown>(method: Method, url: string, options: { params?: Rec; data?: unknown } = {}): Promise<T> {
  const path = url.split("?")[0];
  for (const route of compiled) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(path);
    if (!match) continue;
    const params: Rec = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(match[i + 1])]));
    const body = options.data && typeof options.data === "object" ? (detach(options.data) as Rec) : {};
    try {
      return detach((await route.handler({ params, data: body, query: options.params ?? {} })) ?? null) as T;
    } catch (err) {
      discard(); // a refused request must not leave a half-applied change in memory
      throw err;
    }
  }
  throw new LocalApiError(404, `There is no such page of data (${method} ${path}).`);
}
