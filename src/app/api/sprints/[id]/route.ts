import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { closeAndStartNext, localToday, sprintEndFor, validPodIds } from "@/server/sprintRules";
import type { SprintInput } from "@/types/backlog";

export const dynamic = "force-dynamic";

/** Updates a sprint. Renaming also moves the sprint's items to the new name. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/sprints/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await readBody<Partial<SprintInput>>(request);
    const name = body.name?.trim().replace(/\s+/g, " ");
    if (body.name !== undefined && !name) throw new HttpError(400, "Sprint name can't be empty");
    // The end date can't be set on its own: a sprint is one week from its start date.
    const { end: _ignoredEnd, status: wantedStatus, ...rest } = body;
    void _ignoredEnd;
    if (wantedStatus !== undefined && wantedStatus !== "Closed" && wantedStatus !== "Active") {
      throw new HttpError(400, "Status is invalid");
    }
    const end = body.start ? sprintEndFor(body.start) : undefined;

    const sprint = await withDb((db) => {
      const index = db.sprints.findIndex((s) => s.id === id);
      if (index === -1) throw new HttpError(404, "Sprint not found");
      const current = db.sprints[index];
      if (current.name === "Unplanned") throw new HttpError(403, "The Unplanned sprint can't be edited");
      if (name && db.sprints.some((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, `A sprint named "${name}" already exists`, "duplicate");
      }
      // A sprint can be closed when it is finished; a closed sprint stays closed (start a new one instead).
      if (wantedStatus === "Active" && current.status === "Closed") {
        throw new HttpError(409, `${current.name} is closed. Start a new sprint instead.`, "sprint_closed");
      }
      const status = wantedStatus ?? current.status;
      const podIds = body.podIds === undefined ? current.podIds : validPodIds(db, body.podIds);
      const updated = {
        ...current,
        ...rest,
        ...(end ? { end } : {}),
        ...(podIds ? { podIds } : {}),
        ...(status ? { status } : {}),
        id,
        name: name ?? current.name,
      };
      db.sprints[index] = updated;
      // Closing the running sprint by hand: its unfinished tasks move to the next sprint, which starts right away.
      if (wantedStatus === "Closed" && current.status !== "Closed") closeAndStartNext(db, id, localToday(), true);
      if (updated.name !== current.name) {
        for (const item of db.items) if (item.sprint === current.name) item.sprint = updated.name;
      }
      // A task's POD must stay one of the sprint's PODs: tasks whose POD was removed lose it.
      if (podIds) {
        for (const item of db.items) {
          if (item.sprint === updated.name && item.podId && !podIds.includes(item.podId)) delete item.podId;
        }
      }
      return db.sprints[index];
    }, true);
    return Response.json(sprint);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Deletes a sprint. Its items move to "Unplanned" and the hours logged against it are removed. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/sprints/[id]">) {
  try {
    const { id } = await ctx.params;
    await withDb((db) => {
      const index = db.sprints.findIndex((s) => s.id === id);
      if (index === -1) throw new HttpError(404, "Sprint not found");
      const { name } = db.sprints[index];
      if (name === "Unplanned") throw new HttpError(403, "The Unplanned sprint can't be deleted");
      db.sprints.splice(index, 1);
      for (const item of db.items) {
        if (item.sprint === name) {
          item.sprint = "Unplanned";
          delete item.podId; // PODs belong to a sprint
        }
      }
      db.workEntries = db.workEntries.filter((e) => e.sprintId !== id);
    }, true);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
