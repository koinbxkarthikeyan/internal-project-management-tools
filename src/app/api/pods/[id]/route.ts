import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import type { PodPatch } from "@/types/work";

export const dynamic = "force-dynamic";

const UNPLANNED = "Unplanned";

export async function GET(_request: Request, ctx: RouteContext<"/api/pods/[id]">) {
  try {
    const { id } = await ctx.params;
    const pod = await withDb((db) => db.pods.find((p) => p.id === id));
    if (!pod) throw new HttpError(404, "POD not found");
    return Response.json(pod);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Renames a POD (time already logged keeps showing the new name) and/or hides or unhides it. PODs are never deleted. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/pods/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await readBody<PodPatch>(request);
    const name = body.name === undefined ? undefined : body.name.trim().replace(/\s+/g, " ");
    if (name === "") throw new HttpError(400, "POD name is required");
    if (body.hidden !== undefined && typeof body.hidden !== "boolean") throw new HttpError(400, "Hidden must be true or false");

    const pod = await withDb((db) => {
      const current = db.pods.find((p) => p.id === id);
      if (!current) throw new HttpError(404, "POD not found");
      if (name !== undefined && name !== current.name) {
        if (db.pods.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
          throw new HttpError(409, `POD "${name}" already exists`);
        }
        const old = current.name;
        current.name = name;
        for (const e of db.workEntries) {
          if (e.podId !== id) continue;
          if (e.pod === old) e.pod = name;
          else if (e.pod === `${old} + ${UNPLANNED}`) e.pod = `${name} + ${UNPLANNED}`;
        }
      }
      if (body.hidden !== undefined) {
        if (body.hidden) current.hidden = true;
        else delete current.hidden;
      }
      return current;
    }, true);
    return Response.json(pod);
  } catch (err) {
    return errorResponse(err);
  }
}
