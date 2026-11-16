import { beforeEach, describe, expect, it } from "vitest";
import { asUser, addSprint, addUser, freshDatabase, saved } from "../testing/harness";
import type { DbUser } from "../db";

/** Personal leave (`/work-entries/leaves`) and a sprint's common leave (`commonLeaves` on the sprint). Sprint 1 runs Mon 2 Nov to Sun 15 Nov 2026. */
let me: DbUser, other: DbUser, admin: DbUser, sprintId: number;

beforeEach(() => {
  freshDatabase();
  me = addUser("Me");
  other = addUser("Other");
  admin = addUser("Admin", "ADMIN");
  sprintId = addSprint();
  saved();
});

const add = (who: DbUser, data: Record<string, unknown>) => asUser<{ id: number; date: string; hours?: number }>(who, "POST", "/work-entries/leaves", { sprintId, ...data });
const list = (who: DbUser) => asUser<{ id: number; date: string; userId: number; hours?: number }[]>(who, "GET", "/work-entries/leaves");
const status = (p: Promise<unknown>, code: number) => expect(p).rejects.toMatchObject({ status: code });

describe("personal leave", () => {
  it("adds a whole day or part of a day, and lists only the person's own", async () => {
    await add(me, { date: "2026-11-04" });
    await add(me, { date: "2026-11-05", hours: 2 });
    await add(other, { date: "2026-11-06" });
    const mine = await list(me);
    expect(mine.map((l) => [l.date, l.hours ?? null])).toEqual([["2026-11-04", null], ["2026-11-05", 2]]);
    expect(mine.every((l) => l.userId === me.id)).toBe(true);
  });

  it("refuses a weekend, a day outside the sprint, a repeat and bad hours", async () => {
    await status(add(me, { date: "2026-11-07" }), 400); // Saturday
    await status(add(me, { date: "2026-11-30" }), 400); // after the sprint
    await add(me, { date: "2026-11-09" });
    await status(add(me, { date: "2026-11-09" }), 409);
    await status(add(me, { date: "2026-11-10", hours: -1 }), 400);
    await status(add(me, { date: "not a date" }), 400);
  });

  it("refuses a day that is already a common leave day", async () => {
    await asUser(admin, "PATCH", `/sprints/${sprintId}`, { commonLeaves: [{ date: "2026-11-11", description: "Holiday" }] });
    await status(add(me, { date: "2026-11-11" }), 409);
  });

  it("removes only one's own leave day", async () => {
    const mineDay = await add(me, { date: "2026-11-04" });
    await status(asUser(other, "DELETE", `/work-entries/leaves/${mineDay.id}`), 404);
    await asUser(me, "DELETE", `/work-entries/leaves/${mineDay.id}`);
    expect(await list(me)).toEqual([]);
  });

  it("is read-only once the sprint is closed", async () => {
    const day = await add(me, { date: "2026-11-04" });
    await asUser(admin, "POST", `/sprints/${sprintId}/close`);
    await status(add(me, { date: "2026-11-05" }), 403);
    await status(asUser(me, "DELETE", `/work-entries/leaves/${day.id}`), 403);
  });
});

describe("a sprint's common leave", () => {
  it("is saved with the sprint and replaced by the full list on each save", async () => {
    await asUser(admin, "PATCH", `/sprints/${sprintId}`, { commonLeaves: [{ date: "2026-11-04", description: "Diwali" }, { date: "2026-11-05", description: " Day  off " }, { date: "2026-11-04", description: "Repeat" }] });
    let sprints = await asUser<{ id: number; commonLeaves?: { date: string; description: string }[] }[]>(me, "GET", "/sprints");
    expect(sprints[0].commonLeaves).toEqual([{ date: "2026-11-04", description: "Diwali" }, { date: "2026-11-05", description: "Day off" }]); // the repeat is dropped, spaces tidied
    await asUser(admin, "PATCH", `/sprints/${sprintId}`, { goal: "No change to leave" });
    sprints = await asUser(me, "GET", "/sprints");
    expect(sprints[0].commonLeaves).toHaveLength(2); // left out: kept
    await asUser(admin, "PATCH", `/sprints/${sprintId}`, { commonLeaves: [] });
    sprints = await asUser(me, "GET", "/sprints");
    expect(sprints[0].commonLeaves).toEqual([]);
  });

  it("can be set only by an admin", async () => {
    await status(asUser(me, "PATCH", `/sprints/${sprintId}`, { commonLeaves: [{ date: "2026-11-04", description: "x" }] }), 403);
  });
});
