import { beforeEach, describe, expect, it } from "vitest";
import { asUser, addItem, addSprint, addUser, freshDatabase, saved } from "../testing/harness";
import type { DbItem, DbUser } from "../db";

/** The Ticket rules in the table at `canWork` (items.ts): who may change what on a Ticket, tried as each kind of person. */
let creator: DbUser, assignee: DbUser, outsider: DbUser, qa: DbUser, admin: DbUser, superAdmin: DbUser;
let ticket: DbItem;

beforeEach(() => {
  freshDatabase();
  creator = addUser("Creator");
  assignee = addUser("Assignee");
  outsider = addUser("Outsider");
  qa = addUser("Qa", "USER", "QA");
  admin = addUser("Admin", "ADMIN");
  superAdmin = addUser("Boss", "SUPER_ADMIN");
  const sprintId = addSprint();
  const task = addItem({ type: "TASK", status: "TESTING", sprintId });
  ticket = addItem({ type: "TICKET", status: "OPEN", sprintId, parentId: task.id, code: "TKT-001", createdById: creator.id, assigneeIds: [assignee.id] });
  saved();
});

const edit = (who: DbUser, data: Record<string, unknown>) => asUser(who, "PATCH", `/items/${ticket.id}/ticket`, data);
const move = (who: DbUser, status = "IN_PROGRESS") => asUser(who, "PATCH", `/items/${ticket.id}/status`, { status, details: "working on it" });
const refused = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ status: 403 });

describe("Ticket Priority and Assignees", () => {
  it("can be changed by the creator and the admins", async () => {
    await expect(edit(creator, { priority: "HIGH" })).resolves.toBeTruthy();
    await expect(edit(admin, { priority: "LOW" })).resolves.toBeTruthy();
    await expect(edit(superAdmin, { assigneeIds: [assignee.id, outsider.id] })).resolves.toBeTruthy();
  });

  it("is refused to an assigned user, QA and anyone else", async () => {
    await refused(edit(assignee, { priority: "HIGH" }));
    await refused(edit(assignee, { assigneeIds: [] }));
    await refused(edit(qa, { priority: "HIGH" }));
    await refused(edit(outsider, { assigneeIds: [outsider.id] }));
  });
});

describe("Ticket status", () => {
  it("can be changed by the creator, an assigned user and the admins", async () => {
    await expect(move(creator)).resolves.toBeTruthy();
    await expect(move(assignee, "OPEN")).resolves.toBeTruthy();
    await expect(move(admin)).resolves.toBeTruthy();
  });

  it("is refused to QA and anyone with no part in the Ticket", async () => {
    await refused(move(qa));
    await refused(move(outsider));
  });

  it("only lets the creator and the admins mark it Done, not an assigned user", async () => {
    await refused(move(assignee, "COMPLETED"));
    await expect(move(creator, "COMPLETED")).resolves.toBeTruthy();
  });
});

describe("Ticket title and description", () => {
  it("can be changed by the creator only", async () => {
    await expect(edit(creator, { title: "New title" })).resolves.toBeTruthy();
    await expect(edit(creator, { description: "More detail" })).resolves.toBeTruthy();
    await refused(edit(superAdmin, { title: "Other" }));
    await refused(edit(assignee, { title: "Other" }));
    await refused(edit(admin, { description: "Other" }));
  });
});
