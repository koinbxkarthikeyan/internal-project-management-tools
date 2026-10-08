import { HttpError, errorResponse, readBody, withDb } from "@/server/db";
import { MAX_ROLE_LENGTH } from "@/constants/owner-roles";
import type { Owner, OwnerInput } from "@/types/backlog";

export const dynamic = "force-dynamic";

const clean = (v?: string) => (v ?? "").trim().replace(/\s+/g, " ");

export async function GET() {
  try {
    return Response.json(await withDb((db) => db.owners));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody<OwnerInput>(request);
    const name = body.name?.trim().replace(/\s+/g, " ");
    if (!name) throw new HttpError(400, "Owner name is required");
    const role = clean(body.role);
    const team = clean(body.team);
    if (role.length > MAX_ROLE_LENGTH || team.length > MAX_ROLE_LENGTH) throw new HttpError(400, "Role or team is too long");

    const result = await withDb((db) => {
      const existing = db.owners.find((o) => o.name.toLowerCase() === name.toLowerCase());
      if (existing) throw new HttpError(409, `Owner "${existing.name}" already exists`);
      const owner: Owner = {
        id: `owner-${crypto.randomUUID()}`,
        name,
        ...(role ? { role } : {}),
        ...(team ? { team } : {}),
      };
      // Keep "Unassigned" last.
      const at = db.owners.findIndex((o) => o.name === "Unassigned");
      db.owners.splice(at === -1 ? db.owners.length : at, 0, owner);
      return owner;
    }, true);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
