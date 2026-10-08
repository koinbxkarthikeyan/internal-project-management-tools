import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { assertNoRunningSprint, sprintEndFor, validPodIds } from "@/server/sprintRules";
import type { SprintInput } from "@/types/backlog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await withDb((db) => db.sprints));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody<SprintInput>(request);
    const name = body.name?.trim().replace(/\s+/g, " ");
    if (!name) throw new HttpError(400, "Sprint name is required");
    // A sprint is always one week long, so the end date follows from the start date.
    const end = body.start ? sprintEndFor(body.start) : undefined;

    const sprint = await withDb((db) => {
      if (db.sprints.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, `A sprint named "${name}" already exists`, "duplicate");
      }
      // Only one sprint runs at a time: the next one can start only after the current one is closed.
      assertNoRunningSprint(db);
      const created = {
        ...body,
        name,
        ...(end ? { end } : {}),
        podIds: validPodIds(db, body.podIds),
        status: "Active" as const,
        id: `sprint-${crypto.randomUUID()}`,
      };
      // Keep "Unplanned" last.
      const at = db.sprints.findIndex((s) => s.name === "Unplanned");
      db.sprints.splice(at === -1 ? db.sprints.length : at, 0, created);
      return created;
    }, true);
    return Response.json(sprint, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
