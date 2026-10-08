import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { assertPlacement } from "@/server/sprintRules";
import type { BacklogItemData, NewItemInput } from "@/types/backlog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await withDb((db) => db.items));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody<NewItemInput>(request);
    if (!body.title?.trim()) throw new HttpError(400, "Title is required");
    if (!body.owner?.trim()) throw new HttpError(400, "Owner is required");

    const item = await withDb((db) => {
      // A new task is either a POD task in the running sprint, or an Unplanned task (no POD).
      assertPlacement(db, body.sprint, body.podId);
      if (body.sprint === "Unplanned") delete body.podId;
      const max = db.items.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, "")) || 0), 0);
      const created: BacklogItemData = { ...body, title: body.title.trim(), id: `BLG-${max + 1}` };
      db.items.unshift(created);
      return created;
    }, true);
    return Response.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
