import { db, replaceDb, type Db } from "./db";
import { requireUser } from "./core";
import { fail } from "./errors";

/** The marker a backup file carries, so a file that is not one of ours is recognised. */
const APP = "koinbx-backlog-tracker";

export type BackupSummary = { exportedAt: string; users: number; tasks: number; sprints: number; owners: number; entries: number; comments: number };

const summaryOf = (d: Db, exportedAt: string): BackupSummary => ({ exportedAt, users: d.users.length, tasks: d.items.length, sprints: d.sprints.length, owners: d.owners.length, entries: d.entries.length, comments: d.comments.length });

/**
 * Everything in the shared data as one JSON text, for the Super Admin to keep. It includes each person's password hash (so sign-ins work after a restore) and never a
 * password; it is private data and is meant to be stored like one.
 */
export function exportDatabase(): { text: string; summary: BackupSummary } {
  const me = requireUser();
  if (me.role !== "SUPER_ADMIN") fail(403, "Only the Super Admin can export the data.");
  const exportedAt = new Date().toISOString();
  // The image files are kept apart (see lib/server/store.ts) and are not in this file; their details are left out so nothing in it points at a missing image.
  const data: Db = { ...db(), attachments: [] };
  return { text: JSON.stringify({ app: APP, exportedAt, db: data }, null, 2), summary: summaryOf(db(), exportedAt) };
}

const ARRAYS = ["users", "owners", "pods", "sprints", "items", "entries", "comments", "notifications"] as const;

/** Reads and checks a backup file's text. Throws a message the person can act on; nothing is changed. */
export function readBackup(text: string): { data: Db; summary: BackupSummary } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(400, "That file isn't a backup (it isn't valid JSON).");
  }
  const file = parsed as { app?: unknown; exportedAt?: unknown; db?: Partial<Db> };
  if (!file || typeof file !== "object" || file.app !== APP || !file.db || typeof file.db !== "object") fail(400, "That file isn't a KoinBX Backlog Tracker backup.");
  const data = checkDb(file.db as Db);
  return { data, summary: summaryOf(data, typeof file.exportedAt === "string" ? file.exportedAt : "") };
}

/** Checks the shape of a whole database (a backup's, or one imported from a browser). Throws a message the person can act on; nothing is changed. */
export function checkDb(data: Db): Db {
  if (data.version !== 1) fail(400, "That backup was made by a different version of the app and can't be restored here.");
  for (const key of ARRAYS) if (!Array.isArray(data[key])) fail(400, `That backup is damaged (the list of ${key} is missing).`);
  if (!data.seq || typeof data.seq !== "object") fail(400, "That backup is damaged (its counters are missing).");
  if (!data.users.some((u) => u.role === "SUPER_ADMIN")) fail(400, "That backup has no Super Admin, so nobody could sign in after restoring it.");
  const row = (v: unknown) => !!v && typeof v === "object" && typeof (v as { id?: unknown }).id === "number";
  for (const key of ARRAYS) if (!(data[key] as unknown[]).every(row)) fail(400, `That backup is damaged (a row in ${key} is not valid).`);
  return data;
}

/** Replaces everything in the shared data with a backup's data. Only the Super Admin may. */
export function restoreDatabase(text: string): BackupSummary {
  const me = requireUser();
  if (me.role !== "SUPER_ADMIN") fail(403, "Only the Super Admin can restore data.");
  const { data, summary } = readBackup(text);
  // Images stay where they are: those whose Ticket is in the restored data keep showing. (A backup file never carries images.)
  const ids = new Set(data.items.map((i) => i.id));
  data.attachments = db().attachments.filter((a) => ids.has(a.itemId));
  replaceDb(data);
  return summary;
}
