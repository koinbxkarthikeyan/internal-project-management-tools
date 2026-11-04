import { DEFAULT_INITIAL_PASSWORD } from "@/constants/auth";
import { db, nextId, save, type DbUser } from "../db";
import { clean, currentUser, nowISO, requireAdmin, requireUser, sessionToken, str, type Req, type Rec } from "../core";
import { fail } from "../errors";
import { hashPassword, verifyPassword } from "../password";

const ROLES = ["ADMIN", "USER"] as const;
const LOCK_AFTER = 5;
const LOCK_MINUTES = 5;

/** A user as the screens read it: never the password record. */
export const userOut = (u: DbUser): Rec => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  team: u.team ?? null,
  accessStatus: u.accessStatus,
  ...(u.mustChangePassword ? { mustChangePassword: true } : {}),
  lastSignInAt: u.lastSignInAt ?? null,
  createdAt: u.createdAt,
});

const emailKey = (v: unknown) => String(v ?? "").trim().toLowerCase();
const findByEmail = (email: string) => db().users.find((u) => u.email === email);
const MIN_PASSWORD = 8;

function checkPassword(password: unknown): string {
  const p = typeof password === "string" ? password : "";
  if (p.length < MIN_PASSWORD) fail(400, `The password must be at least ${MIN_PASSWORD} characters.`);
  return p;
}

// ---------- sign-in ----------

export function setupStatus() {
  return { needed: db().users.length === 0 };
}

/** The very first account: a Super Admin, created once, on an empty app. */
export async function setup({ data }: Req) {
  if (db().users.length > 0) fail(409, "The app is already set up. Sign in instead.");
  const name = clean(data.name);
  const email = emailKey(data.email);
  if (!name) fail(400, "Enter a name.");
  if (!email) fail(400, "Enter an email address.");
  const password = checkPassword(data.password);
  const user: DbUser = { id: nextId("user"), name, email, role: "SUPER_ADMIN", accessStatus: "ENABLED", password: await hashPassword(password), createdAt: nowISO(), lastSignInAt: nowISO() };
  db().users.push(user);
  save();
  return { accessToken: sessionToken(user.id), user: userOut(user) };
}

export function signIn({ data }: Req) {
  const email = emailKey(data.email);
  if (!findByEmail(email)) fail(403, "This email is not registered. Ask an admin to add you.");
  return { next: "PASSWORD" };
}

export async function signInWithPassword({ data }: Req) {
  const user = findByEmail(emailKey(data.email));
  if (!user) fail(403, "This email is not registered. Ask an admin to add you.");
  const u = user as DbUser;
  if (u.lockedUntil && u.lockedUntil > Date.now()) fail(429, `Too many wrong attempts. Try again in ${Math.ceil((u.lockedUntil - Date.now()) / 60_000)} minutes.`);
  if (!(await verifyPassword(String(data.password ?? ""), u.password))) {
    u.failedSignIns = (u.failedSignIns ?? 0) + 1;
    if (u.failedSignIns >= LOCK_AFTER) {
      u.failedSignIns = 0;
      u.lockedUntil = Date.now() + LOCK_MINUTES * 60_000;
      save();
      fail(429, `Too many wrong attempts. Try again in ${LOCK_MINUTES} minutes.`);
    }
    save();
    fail(401, "Wrong email or password.");
  }
  u.failedSignIns = 0;
  delete u.lockedUntil;
  u.lastSignInAt = nowISO();
  save();
  return { accessToken: sessionToken(u.id), user: userOut(u) };
}

export const me = () => userOut(requireUser());

export async function changePassword({ data }: Req) {
  const user = requireUser();
  if (!(await verifyPassword(String(data.currentPassword ?? ""), user.password))) fail(400, "The current password is wrong.");
  const next = checkPassword(data.newPassword);
  if (next === data.currentPassword) fail(400, "Choose a password different from the current one.");
  user.password = await hashPassword(next);
  delete user.mustChangePassword;
  save();
  return { ok: true };
}

// ---------- users ----------

export const listOptions = () => (requireUser(), db().users.map(userOut));

export function list() {
  requireAdmin();
  return db().users.map(userOut);
}

function checkRole(role: unknown): DbUser["role"] {
  const r = String(role ?? "USER").toUpperCase();
  if (!(ROLES as readonly string[]).includes(r)) fail(400, "Choose Admin or User. A Super Admin can't be assigned.");
  return r as DbUser["role"];
}

export async function create({ data }: Req) {
  requireAdmin();
  const name = clean(data.name);
  const email = emailKey(data.email);
  if (!name) fail(400, "Enter a name.");
  if (!email) fail(400, "Enter an email address.");
  if (findByEmail(email)) fail(409, "A user with this email already exists.");
  const password = checkPassword(data.password);
  const user: DbUser = {
    id: nextId("user"),
    name,
    email,
    role: checkRole(data.role),
    team: str(data.team) ? clean(data.team) : null,
    accessStatus: String(data.accessStatus ?? "ENABLED").toUpperCase() === "DISABLED" ? "DISABLED" : "ENABLED",
    // The shared starting password has to be replaced by the person on their first sign-in.
    ...(password === DEFAULT_INITIAL_PASSWORD ? { mustChangePassword: true } : {}),
    password: await hashPassword(password),
    createdAt: nowISO(),
  };
  db().users.push(user);
  save();
  return userOut(user);
}

function target(id: unknown): DbUser {
  const user = db().users.find((u) => u.id === Number(id));
  if (!user) fail(404, "That user doesn't exist.");
  return user as DbUser;
}

export async function update({ params, data }: Req) {
  const actor = requireAdmin();
  const user = target(params.id);
  if (user.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") fail(403, "Only the Super Admin can change the Super Admin.");
  if (data.name !== undefined) {
    const name = clean(data.name);
    if (!name) fail(400, "Enter a name.");
    user.name = name;
  }
  if (data.email !== undefined) {
    const email = emailKey(data.email);
    if (!email) fail(400, "Enter an email address.");
    if (db().users.some((u) => u.id !== user.id && u.email === email)) fail(409, "A user with this email already exists.");
    user.email = email;
  }
  if (data.role !== undefined && user.role !== "SUPER_ADMIN") user.role = checkRole(data.role);
  if (data.accessStatus !== undefined) setAccess(actor, user, String(data.accessStatus));
  if (data.team !== undefined) user.team = data.team ? clean(data.team) : null;
  if (data.password) {
    const password = checkPassword(data.password);
    user.password = await hashPassword(password);
    if (password === DEFAULT_INITIAL_PASSWORD) user.mustChangePassword = true;
    else delete user.mustChangePassword;
  }
  save();
  return userOut(user);
}

function setAccess(actor: DbUser, user: DbUser, status: string) {
  const next = status.toUpperCase() === "DISABLED" ? "DISABLED" : "ENABLED";
  if (next === "DISABLED" && user.role === "SUPER_ADMIN") fail(403, "The Super Admin's access can't be disabled.");
  if (next === "DISABLED" && user.id === actor.id) fail(403, "You can't disable your own access.");
  user.accessStatus = next;
}

export function access({ params, data }: Req) {
  const actor = requireAdmin();
  const user = target(params.id);
  setAccess(actor, user, String(data.accessStatus ?? ""));
  save();
  return userOut(user);
}

export function remove({ params }: Req) {
  const actor = requireAdmin();
  const user = target(params.id);
  if (user.role === "SUPER_ADMIN") fail(403, "The Super Admin can't be deleted.");
  if (user.id === actor.id) fail(403, "You can't delete your own account.");
  const d = db();
  d.users = d.users.filter((u) => u.id !== user.id);
  for (const item of d.items) {
    if (item.leadId === user.id) item.leadId = null;
    item.assigneeIds = item.assigneeIds.filter((id) => id !== user.id);
  }
  d.entries = d.entries.filter((e) => e.userId !== user.id);
  d.comments = d.comments.filter((c) => c.userId !== user.id);
  d.notifications = d.notifications.filter((n) => n.recipientId !== user.id);
  save();
  return null;
}

export const signedInUser = currentUser;
