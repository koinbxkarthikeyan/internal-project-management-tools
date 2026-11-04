import { db } from "@/lib/localApi/db";
import { failure, readCookie, sameApp } from "@/lib/server/rpc";
import { readBlob, runExclusive, sessionUser, writeBlob } from "@/lib/server/store";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/localApi/handlers/attachments";

export const dynamic = "force-dynamic";

const deny = (status: number, message: string) => Response.json({ error: { status, message } }, { status, headers: { "cache-control": "no-store" } });

/** An image file of an attachment. Signed-in people only; the image is served only as the image type it was registered with. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameApp(req) || !sessionUser(readCookie(req))) return deny(401, "Sign in to continue.");
  const id = Number((await ctx.params).id);
  try {
    return await runExclusive(async () => {
      const attachment = db().attachments.find((a) => a.id === id);
      const bytes = attachment ? readBlob(id) : null;
      if (!attachment || !bytes) return deny(404, "That image isn't stored.");
      return new Response(new Uint8Array(bytes), { headers: { "content-type": attachment.type, "x-content-type-options": "nosniff", "cache-control": "private, max-age=86400" } });
    });
  } catch (err) {
    return failure(err);
  }
}

/** The file of an attachment whose details were just registered: only the person who registered it, once, with the size and type they announced. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameApp(req)) return deny(403, "This request did not come from the app.");
  const userId = sessionUser(readCookie(req));
  if (!userId) return deny(401, "Sign in to continue.");
  const id = Number((await ctx.params).id);
  const bytes = new Uint8Array(await req.arrayBuffer());
  try {
    return await runExclusive(async () => {
      const attachment = db().attachments.find((a) => a.id === id);
      if (!attachment || attachment.userId !== userId) return deny(404, "That image doesn't exist.");
      if (!IMAGE_TYPES.includes(attachment.type) || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES || bytes.length !== attachment.size) return deny(400, "That image doesn't match what was registered.");
      writeBlob(id, bytes);
      return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
    });
  } catch (err) {
    return failure(err);
  }
}
