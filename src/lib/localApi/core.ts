import { isQaTeam } from "@/lib/auth/qaTeam";
import { requestContext } from "@/lib/server/store";
import { db, type DbActivity, type DbItem, type DbUser } from "./db";
import { fail } from "./errors";

export type Rec = Record<string, unknown>;
export type Req = { params: Rec; data: Rec; query: Rec };

export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
export const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
export const clean = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

/** The marker the sign-in answers carry in place of a token: the real session is an httpOnly cookie the API route sets (the page never sees it). */
export const sessionToken = (userId: number) => (void userId, "cookie");

/** The person asking: the account the request's session cookie belongs to (set by the API route), or nobody. */
export function currentUser(): DbUser | undefined {
  const id = requestContext.getStore()?.userId;
  return id ? db().users.find((u) => u.id === id) : undefined;
}

export function requireUser(): DbUser {
  const user = currentUser();
  if (!user) fail(401, "Sign in to continue.");
  return user as DbUser;
}

/** Super Admin, or an Admin whose access is Enabled. These checks decide what the screens offer; they are not secure authorization (the data is in this browser). */
export const isAdminUser = (u: DbUser) => u.role === "SUPER_ADMIN" || (u.role === "ADMIN" && u.accessStatus === "ENABLED");

/** A member of the QA team (their Team is QA / Testing) whose access is Enabled. */
export const isQaUser = (u: DbUser) => u.accessStatus === "ENABLED" && isQaTeam(u.team);

export function requireAdmin(): DbUser {
  const user = requireUser();
  if (!isAdminUser(user)) fail(403, "Only a Super Admin or an enabled Admin can do this.");
  return user;
}

export const userRef = (id?: number | null) => {
  const u = id == null ? undefined : db().users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name } : undefined;
};

/** The code people see for a task: TKT-001 for a Ticket, BLG-<id> for the rest. */
export const codeOf = (item: Pick<DbItem, "id" | "code">) => item.code ?? `BLG-${item.id}`;

export const sprintOf = (item: Pick<DbItem, "sprintId">) => (item.sprintId == null ? undefined : db().sprints.find((s) => s.id === item.sprintId));
export const isSprintClosed = (sprintId?: number | null) => sprintId != null && db().sprints.find((s) => s.id === sprintId)?.status === "CLOSED";

export const findItem = (id: unknown): DbItem => {
  const item = db().items.find((i) => i.id === Number(id));
  if (!item) fail(404, "That task doesn't exist (it may have been deleted).");
  return item as DbItem;
};

export function logActivity(item: DbItem, text: string, userId?: number, extra: Pick<DbActivity, "reopen"> = {}) {
  item.activity.unshift({ id: ++db().seq.activity, text, createdAt: nowISO(), ...(userId ? { userId } : {}), ...extra });
}
