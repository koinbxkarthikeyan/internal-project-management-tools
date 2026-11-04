import { checkDb } from "@/lib/localApi/backup";
import { db, replaceDb, type Db } from "@/lib/localApi/db";
import { LocalApiError } from "@/lib/localApi/errors";
import { failure, sameApp } from "@/lib/server/rpc";
import { endAllSessions, runExclusive, writeBlob } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * One-time move of the data a browser kept before the app had shared storage. It is accepted only while the shared data is still empty (no user exists), so it can never
 * overwrite or duplicate what is there; after it every account, task, Ticket, comment and image is on the server and the people sign in as before.
 */
export async function POST(req: Request) {
  if (!sameApp(req)) return Response.json({ error: { status: 403, message: "This request did not come from the app." } }, { status: 403 });
  try {
    const body = (await req.json()) as { db?: Db; files?: { id?: unknown; base64?: unknown }[] };
    return await runExclusive(async () => {
      if (db().users.length > 0) throw new LocalApiError(409, "The shared data already has users, so nothing was imported.");
      if (!body.db || typeof body.db !== "object") throw new LocalApiError(400, "There was no data to import.");
      const data = checkDb(body.db as Db);
      const known = new Set((data.attachments ?? []).map((a) => a.id));
      for (const f of body.files ?? []) {
        const id = Number(f.id);
        if (known.has(id) && typeof f.base64 === "string") writeBlob(id, Buffer.from(f.base64, "base64"));
      }
      replaceDb(data);
      endAllSessions();
      return Response.json({ data: { users: data.users.length, tasks: data.items.length, images: known.size } }, { headers: { "cache-control": "no-store" } });
    });
  } catch (err) {
    return failure(err);
  }
}
