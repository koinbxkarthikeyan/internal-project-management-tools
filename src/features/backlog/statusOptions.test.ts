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

  it("offers a Ticket's creator, QA and admins every status; everyone else hands it to QA and then cannot move it on", () => {
    const ticket = (status: string) => task(status, "Sprint 1", "Ticket");
    // the creator, and QA / admins (canComplete)
    expect(values(statusOptionsFor(ticket("Open"), false, false, true))).toContain("Done");
    expect(values(statusOptionsFor(ticket("Open"), true, true))).toEqual(expect.arrayContaining(["Ready for QA", "Testing", "Done"]));
    // someone else on the Ticket: Ready for QA yes, Testing and Done no
    expect(values(statusOptionsFor(ticket("In progress"), false, false))).toEqual(expect.arrayContaining(["Open", "In progress", "Ready for QA", "Blocked", "On hold"]));
    expect(values(statusOptionsFor(ticket("In progress"), false, false))).not.toContain("Testing");
    expect(values(statusOptionsFor(ticket("In progress"), false, false))).not.toContain("Done");
    // a Ticket that QA created: also no Blocked or On hold for the people it is assigned to
    const byQa = (status: string) => ({ ...ticket(status), createdByTeam: "QA" }) as Parameters<typeof statusOptionsFor>[0];
    expect(values(statusOptionsFor(byQa("Open"), false, false))).toEqual(["Open", "In progress", "Ready for QA"]);
    expect(values(statusOptionsFor(byQa("Open"), false, false, true))).toEqual([...STATUSES]);
    // once with QA they can only see where it is
    expect(values(statusOptionsFor(ticket("Ready for QA"), false, false))).toEqual(["Ready for QA"]);
    expect(values(statusOptionsFor(ticket("Testing"), false, false))).toEqual(["Testing"]);
  });
});
