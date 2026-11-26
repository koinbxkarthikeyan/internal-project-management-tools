import { db } from "@/lib/localApi/db";
import { canReadFile } from "@/lib/localApi/handlers/messages";
import { requestContext, readBlob, runExclusive, sessionUser, writeBlob } from "@/lib/server/store";
import { failure, readCookie, sameApp } from "@/lib/server/rpc";
import { LIMIT_OF } from "@/lib/chatConfig";

export const dynamic = "force-dynamic";

const deny = (status: number, message: string) => Response.json({ error: { status, message } }, { status, headers: { "cache-control": "no-store" } });

/** Types shown by the browser itself inside the page (a picture, a video, a sound, a PDF, plain text); everything else is only ever downloaded. */
const inlineOk = (type: string, kind: string) => kind === "image" || kind === "video" || kind === "audio" || type === "application/pdf" || type === "text/plain";

/**
 * A file sent in a chat. Signed-in people who may read that chat only. It is served as the type it was registered with (never sniffed), as a download unless it is a picture,
 * video, sound, PDF or plain text and the page asked to show it (`?inline=1`); `?download=1` always downloads. Video and audio answer byte ranges, so they can play and be skipped through.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // A picture, a video or a sound in the page is fetched by the browser itself, which cannot add the app's header; it says instead that the request comes from this same site
  // (`sec-fetch-site`). A request from another site is refused, and the sign-in cookie is not sent with one anyway (SameSite=Lax).
  const site = req.headers.get("sec-fetch-site");
  if (!sameApp(req) && site !== "same-origin" && site !== "none") return deny(403, "This request did not come from the app.");
  const userId = sessionUser(readCookie(req));
  if (!userId) return deny(401, "Sign in to continue.");
  const id = Number((await ctx.params).id);
  const url = new URL(req.url);
  try {
    return await runExclusive(async () =>
      requestContext.run({ userId, ip: "" }, async () => {
        const user = db().users.find((u) => u.id === userId);
        const file = db().chatFiles.find((f) => f.id === id);
        if (!user || !file || !canReadFile(user, file)) return deny(404, "That file isn't available.");
        const bytes = readBlob(id);
        if (!bytes) return deny(404, "That file isn't stored.");
        const download = url.searchParams.get("download") === "1" || !(url.searchParams.get("inline") === "1" && inlineOk(file.type, file.kind));
        const name = encodeURIComponent(file.name);
        const headers: Record<string, string> = {
          "content-type": file.type || "application/octet-stream",
          "x-content-type-options": "nosniff",
          "accept-ranges": "bytes",
          "cache-control": "private, max-age=3600",
          "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
          // Whatever is shown inside the page can never run script or reach the app. (A PDF is the one exception: the browser's PDF viewer does not work inside a sandbox; the file is only ever shown, as a PDF.)
          ...(file.type === "application/pdf" ? {} : { "content-security-policy": "sandbox" }),
        };
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
        if (range && (range[1] || range[2])) {
          const size = bytes.length;
          const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
          const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
          return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
        }
        return new Response(new Uint8Array(bytes), { headers: { ...headers, "content-length": String(bytes.length) } });
      }),
    );
  } catch (err) {
    return failure(err);
  }
}

/** The bytes of a file whose details were just registered (POST /messages/files): only the person who registered it, with the size they announced, until it is sent. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameApp(req)) return deny(403, "This request did not come from the app.");
  const userId = sessionUser(readCookie(req));
  if (!userId) return deny(401, "Sign in to continue.");
  const id = Number((await ctx.params).id);
  const bytes = new Uint8Array(await req.arrayBuffer());
  try {
    return await runExclusive(async () => {
      const file = db().chatFiles.find((f) => f.id === id);
      if (!file || file.userId !== userId || file.ref) return deny(404, "That file isn't waiting for an upload.");
      if (bytes.length === 0 || bytes.length > LIMIT_OF[file.kind] || bytes.length !== file.size) return deny(400, "That file doesn't match what was registered.");
      writeBlob(id, bytes);
      return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
    });
  } catch (err) {
    return failure(err);
  }
}
