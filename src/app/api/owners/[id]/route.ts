import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { MAX_ROLE_LENGTH } from "@/constants/owner-roles";
import type { Owner, OwnerUpdate } from "@/types/backlog";

export const dynamic = "force-dynamic";

const UNASSIGNED = "Unassigned";

/** Renames an owner; their items follow the new name. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/owners/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await readBody<OwnerUpdate>(request);
    const name = body.name?.trim().replace(/\s+/g, " ");
    if (!name) throw new HttpError(400, "Owner name is required");
    if ((body.role?.length ?? 0) > MAX_ROLE_LENGTH || (body.team?.length ?? 0) > MAX_ROLE_LENGTH) {
      throw new HttpError(400, "Role or team is too long");
    }

    const owner = await withDb((db) => {
      const index = db.owners.findIndex((o) => o.id === id);
      if (index === -1) throw new HttpError(404, "Owner not found");
      const current = db.owners[index];
      if (current.name === UNASSIGNED) throw new HttpError(403, `"${UNASSIGNED}" can't be edited`);
      if (db.owners.some((o) => o.id !== id && o.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, `Owner "${name}" already exists`);
      }
      // undefined keeps a field, "" clears it, a value sets it.
      const pick = (next: string | undefined, prev: string | undefined) =>
        next === undefined ? prev : next.trim().replace(/\s+/g, " ") || undefined;
      const role = pick(body.role, current.role);
      const team = pick(body.team, current.team);
      const updated: Owner = { id: current.id, name, ...(role ? { role } : {}), ...(team ? { team } : {}) };
      db.owners[index] = updated;
      for (const item of db.items) if (item.owner === current.name) item.owner = name;
      return updated;
    }, true);
    return Response.json(owner);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Deletes an owner; their items are moved to "Unassigned". */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/owners/[id]">) {
  try {
    const { id } = await ctx.params;
    await withDb((db) => {
      const index = db.owners.findIndex((o) => o.id === id);
      if (index === -1) throw new HttpError(404, "Owner not found");
      const { name } = db.owners[index];
      if (name === UNASSIGNED) throw new HttpError(403, `"${UNASSIGNED}" can't be deleted`);
      db.owners.splice(index, 1);
      for (const item of db.items) if (item.owner === name) item.owner = UNASSIGNED;
    }, true);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
