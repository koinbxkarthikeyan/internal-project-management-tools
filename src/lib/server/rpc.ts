import { db } from "@/lib/localApi/db";
import { LocalApiError } from "@/lib/localApi/errors";
import { dispatch, type Method } from "@/lib/localApi/routes";
import { createSession, endSession, endUserSessions, requestContext, runExclusive, sessionUser, state } from "./store";

/**
 * The server's one door. The page sends every request here (POST /api/rpc with { method, url, params, data }); the routes of lib/localApi answer it from the shared data,
 * as the signed-in person the session cookie names. The cookie is httpOnly (the page's scripts never see it), SameSite=Lax, Secure over https, and lasts a week of use.
 */
export const COOKIE = "koinbx_session";
const METHODS = new Set<Method>(["GET", "POST", "PATCH", "DELETE"]);

export const readCookie = (req: Request, name = COOKIE): string | undefined => {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || undefined;
  }
  return undefined;
};

const secure = (req: Request) => new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
const setCookie = (req: Request, token: string, maxAge: number) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? "; Secure" : ""}`;

/** Only this app's own page can call the API: a custom header can't be sent by another site without the browser asking first, which the server never allows. */
export const sameApp = (req: Request) => req.headers.get("x-koinbx-client") === "1";

export const rev = () => `${state().boot}:${state().rev}`;

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });

export const failure = (err: unknown) => {
  if (err instanceof LocalApiError) return json(err.status, { error: { status: err.status, message: err.message } });
  console.error(err);
  return json(500, { error: { status: 500, message: err instanceof Error ? err.message : "The server could not answer." } });
};

export async function handleRpc(req: Request): Promise<Response> {
  if (!sameApp(req)) return json(403, { error: { status: 403, message: "This request did not come from the app." } });
  let body: { method?: unknown; url?: unknown; params?: unknown; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: { status: 400, message: "The request could not be read." } });
  }
  const method = String(body.method ?? "") as Method;
  const url = String(body.url ?? "");
  if (!METHODS.has(method) || !url.startsWith("/")) return json(400, { error: { status: 400, message: "The request is not valid." } });
  const token = readCookie(req);

  try {
    return await runExclusive(async () => {
      const before = rev();
      const userId = sessionUser(token);
      const path = url.split("?")[0];
      const headers: Record<string, string> = {};
      const data = await requestContext.run({ userId }, async () => {
        if (method === "POST" && path === "/auth/sign-out") {
          endSession(token);
          headers["set-cookie"] = setCookie(req, "", 0);
          return { ok: true };
        }
        const result = await dispatch<Record<string, unknown>>(method, url, { params: body.params as Record<string, unknown> | undefined, data: body.data });
        // A sign-in that was accepted starts a session: the cookie is set here, and the answer carries no token for the page to keep.
        if (method === "POST" && (path === "/auth/setup" || path === "/auth/sign-in/password")) {
          const id = Number((result?.user as { id?: unknown } | undefined)?.id);
          if (Number.isFinite(id) && db().users.some((u) => u.id === id)) {
            const session = createSession(id);
            headers["set-cookie"] = setCookie(req, session.token, session.maxAge);
          }
        }
        // A changed password signs the person out of their other computers.
        if (method === "POST" && path === "/auth/change-password" && userId) endUserSessions(userId, token);
        return result;
      });
      return json(200, { data }, { "x-rev-before": before, "x-rev": rev(), ...headers });
    });
  } catch (err) {
    return failure(err);
  }
}
