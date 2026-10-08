import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { assertSprintRunning, localToday } from "@/server/sprintRules";
import { validateWorkEntry } from "@/server/workValidation";
import type { WorkEntry, WorkEntryInput } from "@/types/work";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await withDb((db) => db.workEntries));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody<WorkEntryInput>(request);
    validateWorkEntry(body);
    // Hours can only be logged for days that have happened.
    if (body.to > localToday()) throw new HttpError(400, "Hours can't be logged for days that haven't happened yet");

    const entry = await withDb((db) => {
      assertSprintRunning(db, body.sprintId);
      const created: WorkEntry = {
        ...body,
        task: body.task.trim(),
        id: `work-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
      };
      db.workEntries.push(created);
      return created;
    }, true);
    return Response.json(entry, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
