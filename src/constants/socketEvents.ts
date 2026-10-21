/**
 * Where the live-update (Socket.IO) service is and what its events are called. All of it is optional configuration:
 * with no NEXT_PUBLIC_SOCKET_URL the app makes no socket connection at all. The event names are PROPOSED (see src/types/socket.ts)
 * and can be overridden with the NEXT_PUBLIC_SOCKET_EVENT_* variables until the backend's real names are agreed.
 */
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
export const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || "/socket.io";

export const SOCKET_EVENTS = {
  /** client -> server (with acknowledgement) */
  changeStatus: process.env.NEXT_PUBLIC_SOCKET_EVENT_CHANGE || "task:status:change",
  /** server -> clients, after the change was saved */
  statusChanged: process.env.NEXT_PUBLIC_SOCKET_EVENT_CHANGED || "task:status:changed",
} as const;
