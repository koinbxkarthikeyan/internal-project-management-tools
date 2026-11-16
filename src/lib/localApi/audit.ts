import { db, nextId } from "./db";
import { currentUser, nowISO, requireUser, type Req } from "./core";
import { fail } from "./errors";

const KEEP = 5000; // the newest entries kept; older ones fall off so the log never grows without limit

/**
 * Adds one line to the audit log (who did it is the signed-in person of the request). Call it just before the handler's own `save()`: the line is saved with the change, and a
 * refused request drops both. `target` and `detail` are plain words about the change; never put a password, a hash or a token in them.
 */
export function recordAudit(action: string, target: string, detail?: string) {
  const d = db();
  const me = currentUser();
  d.audit.push({ id: nextId("audit"), at: nowISO(), actorId: me?.id ?? null, actorName: me?.name ?? "System", action, target, ...(detail ? { detail } : {}) });
  if (d.audit.length > KEEP) d.audit.splice(0, d.audit.length - KEEP);
}

/** `GET /audit?limit=`: the newest lines first. Only the Super Admin may read it. */
export function listAudit({ query }: Req) {
  const me = requireUser();
  if (me.role !== "SUPER_ADMIN") fail(403, "Only the Super Admin can read the audit log.");
  const limit = Math.min(1000, Math.max(1, Number(query.limit) || 200));
  return db().audit.slice(-limit).reverse();
}
