import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { assertPlacement } from "@/server/sprintRules";
import type { ItemPatch } from "@/types/backlog";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: RouteContext<"/api/items/[id]">) {
  try {
    const { id } = await ctx.params;
    const patch = await readBody<ItemPatch>(request);
    if (patch.title !== undefined && !patch.title.trim()) throw new HttpError(400, "Title can't be empty");

    const item = await withDb((db) => {
      const index = db.items.findIndex((i) => i.id === id);
      if (index === -1) throw new HttpError(404, `Item ${id} not found`);
      const current = db.items[index];
      const next = { ...current, ...patch, id };
      const sprintChanged = patch.sprint !== undefined && patch.sprint !== current.sprint;
      const podChanged = patch.podId !== undefined && patch.podId !== current.podId;
      if (sprintChanged || podChanged) {
        // Moving a task: it ends up Unplanned (no POD) or in a POD of the running sprint.
        assertPlacement(db, next.sprint, next.podId);
        if (next.sprint === "Unplanned") delete next.podId;
      }
      db.items[index] = next;
      return next;
    }, true);
    return Response.json(item);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/items/[id]">) {
  try {
    const { id } = await ctx.params;
    await withDb((db) => {
      const index = db.items.findIndex((i) => i.id === id);
      if (index === -1) throw new HttpError(404, `Item ${id} not found`);
      db.items.splice(index, 1);
    }, true);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
