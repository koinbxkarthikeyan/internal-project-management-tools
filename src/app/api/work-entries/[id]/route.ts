import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { assertSprintRunning, localToday } from "@/server/sprintRules";
import { validateWorkEntry } from "@/server/workValidation";
import type { WorkEntryPatch } from "@/types/work";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: RouteContext<"/api/work-entries/[id]">) {
  try {
    const { id } = await ctx.params;
    const patch = await readBody<WorkEntryPatch>(request);
    validateWorkEntry(patch, true);

    const entry = await withDb((db) => {
      const index = db.workEntries.findIndex((e) => e.id === id);
      if (index === -1) throw new HttpError(404, "Entry not found");
      const merged = { ...db.workEntries[index], ...patch, id };
      assertSprintRunning(db, merged.sprintId);
      // New end dates can't be in the future (an entry's existing dates are left alone).
      if (patch.to !== undefined && patch.to !== db.workEntries[index].to && patch.to > localToday()) {
        throw new HttpError(400, "Hours can't be logged for days that haven't happened yet");
      }
      if (merged.to < merged.from) throw new HttpError(400, "To date can't be before From date");
      db.workEntries[index] = merged;
      return merged;
    }, true);
    return Response.json(entry);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/work-entries/[id]">) {
  try {
    const { id } = await ctx.params;
    await withDb((db) => {
      const index = db.workEntries.findIndex((e) => e.id === id);
      if (index === -1) throw new HttpError(404, "Entry not found");
      db.workEntries.splice(index, 1);
    }, true);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
