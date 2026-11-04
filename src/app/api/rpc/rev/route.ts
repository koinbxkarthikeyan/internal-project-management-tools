import { readCookie, rev, sameApp } from "@/lib/server/rpc";
import { sessionUser } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** The revision of the shared data (it changes whenever anybody saves something): other computers poll it to learn they should read the data again. Signed-in people only. */
export function GET(req: Request) {
  if (!sameApp(req) || !sessionUser(readCookie(req))) return Response.json({ error: { status: 401, message: "Sign in to continue." } }, { status: 401, headers: { "cache-control": "no-store" } });
  return Response.json({ rev: rev() }, { headers: { "cache-control": "no-store" } });
}
