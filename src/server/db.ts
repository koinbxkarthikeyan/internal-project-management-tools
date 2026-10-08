import { promises as fs } from "fs";
import path from "path";
import type { BacklogItemData, Owner, Sprint } from "@/types/backlog";
import type { Pod, WorkEntry } from "@/types/work";
import { autoRollover, normalizeSprintStatuses } from "./sprintRules";

export type Db = {
  items: BacklogItemData[];
  owners: Owner[];
  sprints: Sprint[];
  workEntries: WorkEntry[];
  pods: Pod[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

async function readJson(file: string): Promise<Db> {
  const db = JSON.parse(await fs.readFile(file, "utf8")) as Partial<Db>;
  // Stores created before these collections existed simply start them empty.
  return { items: [], owners: [], sprints: [], workEntries: [], pods: [], ...db };
}

/** What a brand-new store contains: no data, just the two built-in entries the app relies on. */
const emptyDb = (): Db => ({
  items: [],
  owners: [{ id: "owner-unassigned", name: "Unassigned" }],
  sprints: [{ id: "unplanned", name: "Unplanned" }],
  workEntries: [],
  pods: [],
});

/** Loads the store; `data/db.json` is the only data file and is created empty on first use. */
async function load(): Promise<Db> {
  try {
    const db = await readJson(DB_FILE);
    // Sprints saved before they had a status get one, so exactly one is running at most.
    const normalized = normalizeSprintStatuses(db);
    // A sprint whose end date has passed closes by itself and the next one starts (see sprintRules).
    const rolled = autoRollover(db);
    if (normalized || rolled) await save(db);
    return db;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const fresh = emptyDb();
    await save(fresh);
    return fresh;
  }
}

async function save(db: Db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE); // atomic replace
}

// Requests are processed one at a time so concurrent writes can't clobber each other.
// The queue lives on `globalThis` so every API route shares it, even if the bundler loads this
// module once per route (which would otherwise give each route its own, independent queue).
const shared = globalThis as typeof globalThis & { __dbQueue?: Promise<unknown> };

/** Runs `fn` against the store; the store is saved afterwards when `write` is true. */
export function withDb<T>(fn: (db: Db) => T | Promise<T>, write = false): Promise<T> {
  const run = (shared.__dbQueue ?? Promise.resolve()).then(async () => {
    const db = await load();
    const result = await fn(db);
    if (write) await save(db);
    return result;
  });
  shared.__dbQueue = run.catch(() => undefined);
  return run;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Machine-readable reason the client can react to (e.g. "sprint_running"). */
    public code?: string,
  ) {
    super(message);
  }
}

/** Turns thrown errors into JSON responses. */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return Response.json({ message: err.message, code: err.code }, { status: err.status });
  console.error(err);
  return Response.json({ message: "Internal server error" }, { status: 500 });
}

export async function readBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}
