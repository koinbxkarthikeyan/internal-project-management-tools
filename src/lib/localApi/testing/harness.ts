import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";
import { db, save, type DbItem, type DbUser } from "../db";
import { requestContext } from "@/lib/server/store";
import { dispatch, type Method } from "../routes";

/** Tests run against a throw-away data folder, never the real `.data`: a fresh one for each test, with an empty database. */
export function freshDatabase() {
  // The tests use dates in November 2026; the clock is held there (Wednesday 4 November, 10:30 in India), so a sprint is never closed by the real date moving on.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "koinbx-test-"));
  process.env.KOINBX_DATA_DIR = dir;
  (globalThis as { __koinbxState?: unknown }).__koinbxState = undefined;
  return db();
}

/** Writes what was just set up to the test data file, so a refused request (which reloads the data from the file) does not lose it. */
export const saved = () => save();

const password = { salt: "", hash: "", iterations: 1, engine: "js" as const };

export function addUser(name: string, role: DbUser["role"] = "USER", team: string | null = "Mobile"): DbUser {
  const d = db();
  const user: DbUser = { id: ++d.seq.user, name, email: `${name.toLowerCase()}@koinbx.com`, role, team, accessStatus: "ENABLED", password, createdAt: new Date().toISOString() };
  d.users.push(user);
  return user;
}

export function addSprint(): number {
  const d = db();
  const id = ++d.seq.sprint;
  d.sprints.push({ id, name: `Sprint ${id}`, startDate: "2026-11-02", endDate: "2026-11-15", status: "ACTIVE", createdAt: new Date().toISOString() });
  return id;
}

export function addItem(fields: Partial<DbItem> & Pick<DbItem, "type" | "status">): DbItem {
  const d = db();
  const id = ++d.seq.item;
  const now = new Date().toISOString();
  const item: DbItem = {
    id,
    title: `Item ${id}`,
    priority: "MEDIUM",
    assigneeIds: [],
    historySprintIds: [],
    createdAt: now,
    updatedAt: now,
    activity: [],
    ...fields,
  } as DbItem;
  d.items.push(item);
  return item;
}

/** Calls the data layer as one signed-in person, like a request carrying their session. */
export const asUser = <T>(user: DbUser, method: Method, url: string, data?: unknown) => requestContext.run({ userId: user.id }, () => dispatch<T>(method, url, { data }));
