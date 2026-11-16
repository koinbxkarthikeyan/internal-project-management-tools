import { describe, expect, it } from "vitest";
import { STATUSES } from "@/constants/backlog-options";
import { statusOptionsFor } from "./statusOptions";

const values = (o: { value: string }[]) => o.map((x) => x.value);
const task = (status: string, sprint = "Sprint 1", type?: string) => ({ status, sprint, ...(type ? { type } : {}) }) as Parameters<typeof statusOptionsFor>[0];

describe("statusOptionsFor", () => {
  it("offers an admin every status on a sprint task", () => {
    expect(values(statusOptionsFor(task("Open"), true, true))).toEqual([...STATUSES]);
  });

  it("offers a normal member only the statuses they may set", () => {
    expect(values(statusOptionsFor(task("Open"), false, false))).toEqual(["Open", "In progress", "Ready for QA"]);
  });

  it("offers QA Testing and Done as well, but not Blocked or On hold", () => {
    const qa = values(statusOptionsFor(task("Ready for QA"), false, true));
    expect(qa).toContain("Testing");
    expect(qa).toContain("Done");
    expect(qa).not.toContain("Blocked");
    expect(qa).not.toContain("On hold");
  });

  it("keeps the status a task already has in the list", () => {
    expect(values(statusOptionsFor(task("Blocked"), false, false))).toContain("Blocked");
    expect(values(statusOptionsFor(task("Done"), false, false))).toContain("Done");
  });

  it("offers a Backlog task only To Do, On hold and Blocked (members: To Do only)", () => {
    expect(values(statusOptionsFor(task("Open", "Unplanned"), true, true))).toEqual(["Open", "Blocked", "On hold"]);
    expect(values(statusOptionsFor(task("Open", "Unplanned"), false, false))).toEqual(["Open"]);
  });

  it("never offers a Ticket Ready for QA, and Done only to those who may finish it", () => {
    expect(values(statusOptionsFor(task("Open", "Sprint 1", "Ticket"), false, false))).not.toContain("Ready for QA");
    expect(values(statusOptionsFor(task("Open", "Sprint 1", "Ticket"), false, false))).not.toContain("Done");
    expect(values(statusOptionsFor(task("Open", "Sprint 1", "Ticket"), false, false, true))).toContain("Done");
    expect(values(statusOptionsFor(task("Open", "Sprint 1", "Ticket"), true, true))).toContain("Done");
  });
});
