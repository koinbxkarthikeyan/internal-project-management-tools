/**
 * Where live notifications come from. REST (the notification endpoints) is always used for the list, the unread count and read state. Live delivery needs a
 * WebSocket address of the real notification server: set NEXT_PUBLIC_NOTIFICATIONS_WS_URL to its ws:// or wss:// address. Without it there is no live connection
 * (the bell says so and refreshes from REST periodically); nothing is simulated.
 */
const raw = process.env.NEXT_PUBLIC_NOTIFICATIONS_WS_URL?.trim() ?? "";

function valid(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "ws:" || u.protocol === "wss:") && !!u.host;
  } catch {
    return false;
  }
}

export const NOTIFICATIONS_WS_URL = raw && valid(raw) ? raw : "";
/** A set but unusable address (not ws:// or wss://) is not connected to. */
export const NOTIFICATIONS_WS_URL_INVALID = raw !== "" && !NOTIFICATIONS_WS_URL;

/** How the socket proves who the user is: "message" sends the token in the first frame (default, keeps it out of URLs and logs); "query" puts it in the address as ?token=. */
export const NOTIFICATIONS_WS_AUTH: "message" | "query" = process.env.NEXT_PUBLIC_NOTIFICATIONS_WS_AUTH?.trim() === "query" ? "query" : "message";
