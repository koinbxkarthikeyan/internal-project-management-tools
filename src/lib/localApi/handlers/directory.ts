import { db, nextId, save } from "../db";
import { clean, requireAdmin, requireUser, str, type Req } from "../core";
import { fail } from "../errors";

// ---------- owners ----------

const ownerOut = (o: { id: number; name: string; role?: string; team?: string }) => ({ id: o.id, name: o.name, ...(o.role ? { role: o.role } : {}), ...(o.team ? { team: o.team } : {}) });
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const listOwners = () => (requireUser(), db().owners.map(ownerOut));

export function createOwner({ data }: Req) {
  requireAdmin();
  const name = clean(data.name);
  if (!name) fail(400, "Enter a name.");
  if (name.toLowerCase() === "unassigned" || db().owners.some((o) => sameName(o.name, name))) fail(409, "An owner with this name already exists.");
  const owner = { id: nextId("owner"), name, ...(str(data.role) ? { role: clean(data.role) } : {}), ...(str(data.team) ? { team: clean(data.team) } : {}) };
  db().owners.push(owner);
  save();
  return ownerOut(owner);
}

export function updateOwner({ params, data }: Req) {
  requireAdmin();
  const owner = db().owners.find((o) => o.id === Number(params.id));
  if (!owner) fail(404, "That owner doesn't exist.");
  const o = owner as NonNullable<typeof owner>;
  if (data.name !== undefined) {
    const name = clean(data.name);
    if (!name) fail(400, "Enter a name.");
    if (name.toLowerCase() === "unassigned" || db().owners.some((x) => x.id !== o.id && sameName(x.name, name))) fail(409, "An owner with this name already exists.");
    o.name = name;
  }
  // An empty role or team clears it; leaving it out keeps it.
  if (data.role !== undefined) {
    if (data.role) o.role = clean(data.role);
    else delete o.role;
  }
  if (data.team !== undefined) {
    if (data.team) o.team = clean(data.team);
    else delete o.team;
  }
  save();
  return ownerOut(o);
}

export function deleteOwner({ params }: Req) {
  requireAdmin();
  const d = db();
  if (!d.owners.some((o) => o.id === Number(params.id))) fail(404, "That owner doesn't exist.");
  d.owners = d.owners.filter((o) => o.id !== Number(params.id));
  for (const item of d.items) if (item.ownerId === Number(params.id)) item.ownerId = null;
  save();
  return null;
}

// ---------- PODs ----------

const podOut = (p: { id: number; name: string; hidden?: boolean }) => ({ id: p.id, name: p.name, ...(p.hidden ? { hidden: true } : {}) });

export const listPods = () => (requireUser(), db().pods.map(podOut));

export function createPod({ data }: Req) {
  requireAdmin();
  const name = clean(data.name);
  if (!name) fail(400, "Enter a name.");
  const existing = db().pods.find((p) => sameName(p.name, name));
  if (existing?.hidden) {
    delete existing.hidden; // adding a hidden POD again brings it back
    save();
    return podOut(existing);
  }
  if (existing) fail(409, "A POD with this name already exists.");
  const pod = { id: nextId("pod"), name };
  db().pods.push(pod);
  save();
  return podOut(pod);
}

export function updatePod({ params, data }: Req) {
  requireAdmin();
  const pod = db().pods.find((p) => p.id === Number(params.id));
  if (!pod) fail(404, "That POD doesn't exist.");
  const p = pod as NonNullable<typeof pod>;
  if (data.name !== undefined) {
    const name = clean(data.name);
    if (!name) fail(400, "Enter a name.");
    if (db().pods.some((x) => x.id !== p.id && sameName(x.name, name))) fail(409, "A POD with this name already exists.");
    p.name = name;
  }
  if (data.hidden !== undefined) {
    if (data.hidden) p.hidden = true;
    else delete p.hidden;
  }
  save();
  return podOut(p);
}
