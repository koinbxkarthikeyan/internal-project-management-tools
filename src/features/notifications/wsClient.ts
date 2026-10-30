import { useNotificationConnection } from "./connection";
import { NOTIFICATIONS_WS_AUTH } from "./config";

/**
 * Messages the client and a notification server exchange (JSON text frames). The server must be built to this contract (docs/backend-notifications.md); none exists yet.
 *  client -> server:  { type: "auth", token }                       first frame after the socket opens (a browser can't send headers on a WebSocket)
 *  server -> client:  { type: "notification", event }               one new event for this user
 *                     { type: "notification.read", ids: [...] }     this user read these on another device
 *                     { type: "notification.read_all" }             this user read everything on another device
 * The client never sends events: the server makes them from the changes it processes itself (assign, status, comment), so nothing a browser says can create a notification.
 * Anything else, and any event that fails validation, is ignored. The server checks the token and decides who may receive what; this client never trusts itself.
 */
export type ClientMessage = { type: "auth"; token: string };

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

type Session = {
  url: string;
  userId: string;
  token: string;
  /** A new notification from the server, as sent (the caller checks and converts it). */
  onNotification: (payload: unknown) => void;
  /** The socket is open and authenticated (first time and after every reconnect): the moment to re-read what was missed. */
  onOpen?: () => void;
  /** The server says this person read these notifications (or all of them) elsewhere. */
  onRead?: (ids: string[] | "all") => void;
};

/**
 * The one WebSocket client of the app. It holds at most one socket at a time: asking to connect again for the same person does nothing, for another person
 * closes the old socket first. It reconnects by itself with a growing, jittered delay until it is told to disconnect, and every listener belongs to the socket
 * that was created for it, so an old socket can never deliver into a new session.
 */
class NotificationSocket {
  private socket: WebSocket | null = null;
  private session: Session | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;
  /** How many sockets were opened (for tests and diagnostics). */
  opened = 0;

  connect(session: Session) {
    const same = this.session && this.session.url === session.url && this.session.userId === session.userId;
    this.session = session;
    if (same && this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    this.closeSocket();
    window.clearTimeout(this.timer);
    this.attempt = 0;
    this.open("connecting");
  }

  disconnect() {
    this.session = null;
    window.clearTimeout(this.timer);
    this.closeSocket();
    useNotificationConnection.getState().set("disconnected");
  }

  private open(status: "connecting" | "reconnecting") {
    const session = this.session;
    if (!session) return;
    useNotificationConnection.getState().set(status);
    let socket: WebSocket;
    try {
      const url = NOTIFICATIONS_WS_AUTH === "query" ? `${session.url}${session.url.includes("?") ? "&" : "?"}token=${encodeURIComponent(session.token)}` : session.url;
      socket = new WebSocket(url);
    } catch (err) {
      useNotificationConnection.getState().set("error", err instanceof Error ? err.message : "Could not open the connection.");
      this.schedule();
      return;
    }
    this.opened += 1;
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempt = 0;
      if (NOTIFICATIONS_WS_AUTH === "message") socket.send(JSON.stringify({ type: "auth", token: session.token } satisfies ClientMessage));
      useNotificationConnection.getState().set("connected");
      session.onOpen?.();
    };
    socket.onmessage = (e) => {
      if (this.socket !== socket || typeof e.data !== "string") return;
      let frame: unknown;
      try {
        frame = JSON.parse(e.data);
      } catch {
        return; // not JSON: ignored
      }
      if (typeof frame !== "object" || frame === null) return;
      const f = frame as { type?: unknown; event?: unknown; notification?: unknown; data?: unknown; payload?: unknown; ids?: unknown };
      const kind = typeof f.type === "string" ? f.type.toLowerCase() : "";
      if (kind === "notification.read_all") session.onRead?.("all");
      else if (kind === "notification.read" && Array.isArray(f.ids)) session.onRead?.(f.ids.filter((x): x is string | number => typeof x === "string" || typeof x === "number").map(String).slice(0, 500));
      else if (kind === "notification" || kind === "notification.new" || kind === "new_notification") session.onNotification(f.event ?? f.notification ?? f.data ?? f.payload ?? frame);
    };
    socket.onerror = () => {
      if (this.socket === socket) useNotificationConnection.getState().set("error", "The connection failed.");
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.schedule();
    };
  }

  private schedule() {
    if (!this.session) return;
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempt) * (0.5 + Math.random() * 0.5);
    this.attempt += 1;
    useNotificationConnection.getState().set("reconnecting", useNotificationConnection.getState().detail);
    this.timer = setTimeout(() => this.open("reconnecting"), delay);
  }

  /** Detaches the listeners first so closing never schedules a reconnect or delivers anything. */
  private closeSocket() {
    const s = this.socket;
    this.socket = null;
    if (!s) return;
    s.onopen = s.onmessage = s.onerror = s.onclose = null;
    try {
      s.close(1000);
    } catch {
      // already closed
    }
  }
}

export const notificationSocket = new NotificationSocket();
