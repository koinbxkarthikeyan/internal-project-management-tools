import { beforeEach, describe, expect, it } from "vitest";
import { requestContext } from "@/lib/server/store";
import { dispatch } from "../routes";
import { FAILURES_ALLOWED, resetLimits } from "../rateLimit";
import { addItem, addSprint, addUser, asUser, freshDatabase, saved } from "../testing/harness";
import type { DbAudit, DbUser } from "../db";

let boss: DbUser, admin: DbUser, member: DbUser;

beforeEach(() => {
  freshDatabase();
  resetLimits();
  boss = addUser("Boss", "SUPER_ADMIN");
  admin = addUser("Admin", "ADMIN");
  member = addUser("Member");
  saved();
});

const log = () => asUser<DbAudit[]>(boss, "GET", "/audit");
const actions = async () => (await log()).map((l) => l.action);

describe("the audit log", () => {
  it("records a role change with who did it, to whom and from what to what", async () => {
    await asUser(boss, "PATCH", `/users/${member.id}`, { role: "Admin" });
    const [line] = await log();
    expect(line).toMatchObject({ action: "user.role_changed", actorId: boss.id, actorName: "Boss", detail: "User → Admin" });
    expect(line.target).toContain("Member");
    expect(Date.parse(line.at)).not.toBeNaN();
  });

  it("records access changes, deletions and admin password resets, never the password", async () => {
    await asUser(boss, "PATCH", `/users/${member.id}`, { accessStatus: "Disabled" });
    await asUser(boss, "PATCH", `/users/${admin.id}`, { password: "Brand@New-Secret-77" });
    await asUser(boss, "DELETE", `/users/${member.id}`);
    expect(await actions()).toEqual(["user.deleted", "user.password_reset", "user.access_changed"]);
    expect(JSON.stringify(await log())).not.toContain("Brand@New-Secret-77");
  });

  it("records deleting a task, a sprint and an owner", async () => {
    const sprintId = addSprint();
    const task = addItem({ type: "TASK", status: "OPEN", sprintId: null, title: "Old task" });
    const owner = await asUser<{ id: number }>(boss, "POST", "/owners", { name: "Gone Owner" });
    saved();
    await asUser(boss, "DELETE", `/items/${task.id}`);
    await asUser(boss, "DELETE", `/owners/${owner.id}`);
    await asUser(admin, "POST", `/sprints/${sprintId}/close`);
    await asUser(boss, "DELETE", `/sprints/${sprintId}`);
    expect(await actions()).toEqual(["sprint.deleted", "owner.deleted", "task.deleted"]);
  });

  it("shows the newest line first", async () => {
    await asUser(boss, "PATCH", `/users/${member.id}`, { role: "Admin" });
    await asUser(boss, "PATCH", `/users/${member.id}`, { role: "User" });
    expect((await log()).map((l) => l.detail)).toEqual(["Admin → User", "User → Admin"]);
  });

  it("is readable by the Super Admin only", async () => {
    await expect(asUser(admin, "GET", "/audit")).rejects.toMatchObject({ status: 403 });
    await expect(asUser(member, "GET", "/audit")).rejects.toMatchObject({ status: 403 });
  });

  it("keeps the log through a restore, and records the restore and each export", async () => {
    await asUser(boss, "PATCH", `/users/${member.id}`, { role: "Admin" });
    const { text } = await asUser<{ text: string }>(boss, "GET", "/backup/export");
    await asUser(boss, "PATCH", `/users/${member.id}`, { role: "User" });
    await asUser(boss, "POST", "/backup/restore", { text });
    const all = await actions();
    expect(all.slice(0, 3)).toEqual(["backup.restored", "user.role_changed", "backup.exported"]);
    expect(all).toContain("user.role_changed");
  });

  it("does not keep a line for a request that was refused", async () => {
    await expect(asUser(admin, "PATCH", `/users/${boss.id}`, { role: "User" })).rejects.toMatchObject({ status: 403 });
    expect(await log()).toEqual([]);
  });
});

describe("the limit on wrong sign-in passwords from one address", () => {
  const attempt = (ip: string, email: string) => requestContext.run({ ip }, () => dispatch("POST", "/auth/sign-in/password", { data: { email, password: "wrong" } }));

  it("stops an address after too many wrong passwords (across different accounts, so no account lock is involved) and spares other addresses", async () => {
    const emails = Array.from({ length: FAILURES_ALLOWED + 2 }, (_, i) => addUser(`Person${i}`).email);
    saved();
    for (let i = 0; i < FAILURES_ALLOWED; i++) await expect(attempt("6.6.6.6", emails[i])).rejects.toMatchObject({ status: 401 });
    await expect(attempt("6.6.6.6", emails[FAILURES_ALLOWED])).rejects.toMatchObject({ status: 429 });
    await expect(attempt("7.7.7.7", emails[FAILURES_ALLOWED])).rejects.toMatchObject({ status: 401 });
  });
});
