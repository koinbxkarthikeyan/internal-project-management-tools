import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { todayISO } from "@/lib/today";
import { dailyBackup } from "./dailyBackup";

/**
 * The shared storage of the app, on the machine that runs it: one JSON document for the data (written whole and atomically after every change, so a crash never leaves a
 * half-written file), one file per attached image, and the sign-in sessions (only a hash of each token). Every computer and browser reaches the same files through the
 * app's own API, so everybody sees the same data. Where it lives: the folder in KOINBX_DATA_DIR, or `.data` in the app's folder.
 */
export const dataDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.KOINBX_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data"));

type Session = { userId: number; expires: number };
type State = {
  /** The parsed database (see localApi/db.ts), read from the file once and kept; `null` after a refused request so the next one reads the file again. */
  cache: unknown;
  /** Counts saved changes: other computers poll it to learn that something changed. `boot` tells a restarted server apart. */
  rev: number;
  boot: string;
  lock: Promise<unknown>;
  sessions: Map<string, Session> | null;
  sessionsWritten: number;
  /** Sign-ins waiting for the person already signed in to Allow or Deny them (memory only: they last minutes). Keyed by the hash of the secret the waiting computer holds. */
  approvals?: Map<string, SignInApproval>;
};

/** A correct-password sign-in on a new computer, held until the account's owner answers. `id` is public (the owner's pop-up uses it); the secret never leaves the waiting computer. */
type SignInApproval = { id: string; userId: number; status: "pending" | "allowed" | "denied"; expires: number; at: string; ip: string; agent: string; answer: unknown };

const g = globalThis as { __koinbxState?: State };
export const state = (): State => (g.__koinbxState ??= { cache: null, rev: 0, boot: crypto.randomBytes(4).toString("hex"), lock: Promise.resolve(), sessions: null, sessionsWritten: 0 });

const ensure = (dir: string) => fs.mkdirSync(dir, { recursive: true });

/** Writes a file so that a reader (or a crash) sees either the old content or the new, never half. */
function writeAtomic(file: string, data: string | Uint8Array) {
  ensure(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// ---------- the database file ----------

const dbFile = () => path.join(dataDir(), "db.json");
export const readDbText = (): string | null => (fs.existsSync(dbFile()) ? fs.readFileSync(dbFile(), "utf8") : null);
/**
 * Where the daily safety copies of the database go: `KOINBX_BACKUP_DIR`, or a folder next to the data folder (`.data-backups`). Never inside `public/`, so nothing is served. Point it at
 * another disk (or a synced folder) to survive a failed disk; `KOINBX_BACKUP_KEEP` is how many days are kept (14 by default).
 */
export const backupDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.KOINBX_BACKUP_DIR || `${dataDir()}-backups`);

export const writeDbText = (text: string) => {
  writeAtomic(dbFile(), text);
  // The daily copy must never stop a save, so any trouble with it is only reported.
  try {
    dailyBackup(text, { dir: backupDir(), day: todayISO(), keep: Number(process.env.KOINBX_BACKUP_KEEP) || 14 });
  } catch (err) {
    console.error("The daily backup could not be written:", err);
  }
};
export const bumpRev = () => ++state().rev;

/** One request at a time touches the data (the handlers read and change it in place), so two people saving together can never overwrite each other. */
export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const s = state();
  const next = s.lock.then(fn, fn);
  s.lock = next.catch(() => undefined);
  return next;
}

// ---------- who is asking ----------

/** The signed-in person of the request being answered (set by the API route from the session cookie; handlers read it through `currentUser()`). */
export const requestContext = new AsyncLocalStorage<{ userId?: number; ip?: string }>();

// ---------- images ----------

const blobFile = (id: number) => path.join(dataDir(), "blobs", String(Math.trunc(id)));
export const writeBlob = (id: number, bytes: Uint8Array) => writeAtomic(blobFile(id), bytes);
export const readBlob = (id: number): Buffer | null => (fs.existsSync(blobFile(id)) ? fs.readFileSync(blobFile(id)) : null);
export const removeBlob = (id: number) => fs.rmSync(blobFile(id), { force: true });
export const clearBlobs = () => fs.rmSync(path.join(dataDir(), "blobs"), { recursive: true, force: true });

// ---------- sessions ----------

const SESSION_DAYS = 7;
const sessionsFile = () => path.join(dataDir(), "sessions.json");
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

function sessions(): Map<string, Session> {
  const s = state();
  if (s.sessions) return s.sessions;
  let rows: Record<string, Session> = {};
  try {
    rows = fs.existsSync(sessionsFile()) ? (JSON.parse(fs.readFileSync(sessionsFile(), "utf8")) as Record<string, Session>) : {};
  } catch {
    rows = {};
  }
  const now = Date.now();
  s.sessions = new Map(Object.entries(rows).filter(([, v]) => v.expires > now));
  return s.sessions;
}

function persistSessions(force = false) {
  const s = state();
  if (!force && Date.now() - s.sessionsWritten < 10 * 60_000) return;
  s.sessionsWritten = Date.now();
  writeAtomic(sessionsFile(), JSON.stringify(Object.fromEntries(sessions())));
}

/** A new sign-in: a random token (given to the browser as an httpOnly cookie) of which only the hash is kept. */
export function createSession(userId: number): { token: string; maxAge: number } {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions().set(hash(token), { userId, expires: Date.now() + SESSION_DAYS * 86_400_000 });
  persistSessions(true);
  return { token, maxAge: SESSION_DAYS * 86_400 };
}

/** The user a token belongs to, while it has not expired. Using it keeps it alive another week. */
export function sessionUser(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const found = sessions().get(hash(token));
  if (!found) return undefined;
  if (found.expires < Date.now()) {
    sessions().delete(hash(token));
    return undefined;
  }
  found.expires = Date.now() + SESSION_DAYS * 86_400_000;
  persistSessions();
  return found.userId;
}

export function endSession(token: string | undefined) {
  if (token && sessions().delete(hash(token))) persistSessions(true);
}

/** A session counts as in use while its last request was within this long: a closed browser stops counting, an open page (it asks the server every few seconds) keeps counting. */
const IN_USE_MS = 30 * 60_000;

/** Whether this person is already signed in and in use on a computer: any live session but the one named (the requester's own). */
export function hasActiveSession(userId: number, exceptToken?: string): boolean {
  const keep = exceptToken ? hash(exceptToken) : "";
  const cutoff = Date.now() + SESSION_DAYS * 86_400_000 - IN_USE_MS;
  for (const [key, value] of sessions()) if (value.userId === userId && key !== keep && value.expires > cutoff) return true;
  return false;
}

const APPROVAL_MS = 5 * 60_000;
const MAX_WAITING = 3;
const approvals = () => (state().approvals ??= new Map());
const waiting = (userId: number) => [...approvals().values()].filter((a) => a.userId === userId && a.status === "pending" && a.expires > Date.now()).sort((x, y) => x.expires - y.expires);

/** Holds a correct-password sign-in until the account's owner answers. Returns the secret the waiting computer polls with. At most three wait at once: the oldest is turned down. */
export function requestSignInApproval(userId: number, answer: unknown, ip: string, agent: string): string {
  const open = waiting(userId);
  for (const old of open.slice(0, Math.max(0, open.length - (MAX_WAITING - 1)))) old.status = "denied";
  const secret = crypto.randomBytes(24).toString("hex");
  approvals().set(hash(secret), { id: crypto.randomBytes(8).toString("hex"), userId, status: "pending", expires: Date.now() + APPROVAL_MS, at: new Date().toISOString(), ip, agent: agent.slice(0, 200), answer });
  return secret;
}

/** The sign-ins waiting for this person's answer, oldest first. */
export function pendingSignIns(userId: number) {
  return waiting(userId).map(({ id, at, ip, agent }) => ({ id, at, ip, agent }));
}

/** The owner's answer. False when the request is gone, expired, already answered or not theirs. */
export function decideSignInApproval(id: string, userId: number, allow: boolean): boolean {
  const a = waiting(userId).find((x) => x.id === id);
  if (!a) return false;
  a.status = allow ? "allowed" : "denied";
  return true;
}

/** The waiting computer gave up (Cancel on its waiting screen): its request goes away, so the owner is no longer asked about it. */
export function withdrawSignInApproval(secret: string): void {
  const a = approvals().get(hash(secret));
  if (a?.status === "pending") approvals().delete(hash(secret));
}

/** What the waiting computer asks: still waiting, or the answer (given once, then forgotten). `allowed` carries the sign-in answer and who it was for. */
export function takeSignInApproval(secret: string): { status: "pending" | "denied" | "expired" } | { status: "allowed"; userId: number; answer: unknown } {
  const key = hash(secret);
  for (const [k, a] of approvals()) if (a.expires < Date.now() - 60_000) approvals().delete(k);
  const a = approvals().get(key);
  if (!a || a.expires < Date.now()) return { status: "expired" };
  if (a.status === "pending") return { status: "pending" };
  approvals().delete(key);
  return a.status === "allowed" ? { status: "allowed", userId: a.userId, answer: a.answer } : { status: "denied" };
}

/** Ends every session of a person (a changed password signs out their other computers), except the one named. */
export function endUserSessions(userId: number, except?: string) {
  const keep = except ? hash(except) : "";
  let changed = false;
  for (const [key, value] of sessions()) {
    if (value.userId === userId && key !== keep) {
      sessions().delete(key);
      changed = true;
    }
  }
  if (changed) persistSessions(true);
}

export function endAllSessions() {
  sessions().clear();
  persistSessions(true);
}
