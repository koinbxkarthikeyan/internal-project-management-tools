import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import type { PodInput } from "@/types/work";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await withDb((db) => db.pods));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody<PodInput>(request);
    const name = body.name?.trim().replace(/\s+/g, " ");
    if (!name) throw new HttpError(400, "POD name is required");

    const pod = await withDb((db) => {
      const existing = db.pods.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) throw new HttpError(409, `POD "${existing.name}" already exists`);
      const created = { id: `pod-${crypto.randomUUID()}`, name };
      db.pods.push(created);
      return created;
    }, true);
    return Response.json(pod, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
