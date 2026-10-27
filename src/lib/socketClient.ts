import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { SOCKET_PATH, SOCKET_URL } from "@/constants/socketEvents";
import { sessionStore } from "@/lib/auth/sessionStore";

/**
 * The one Socket.IO client. It does nothing unless NEXT_PUBLIC_SOCKET_URL is set, connects only when asked (and only for a signed-in
 * person), sends the saved access token in the handshake (read fresh on every reconnect, never stored here or logged) and
 * reconnects by itself. Components never touch the socket: they use `emitWithAck`, `onSocketEvent` and `useSocketStore`.
 */
export const socketEnabled = !!SOCKET_URL;

export type SocketStatus = "off" | "connecting" | "connected" | "reconnecting" | "error";

export const useSocketStore = create<{ status: SocketStatus; error: string }>(() => ({ status: "off", error: "" }));
const setStatus = (status: SocketStatus, error = "") => useSocketStore.setState({ status, error });

let socket: Socket | null = null;

function createSocket(): Socket {
  const s = io(SOCKET_URL, {
    path: SOCKET_PATH,
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    // Called for every (re)connection, so a renewed login is picked up.
    auth: (cb) => cb({ token: sessionStore.read()?.token ?? "" }),
  });
  s.on("connect", () => setStatus("connected"));
  s.on("disconnect", (reason) => setStatus(reason === "io client disconnect" ? "off" : "reconnecting"));
  // The message only (for example "unauthorized"); the token never appears in it.
  s.on("connect_error", (err) => setStatus(s.active ? "reconnecting" : "error", err.message));
  s.io.on("reconnect_attempt", () => setStatus("reconnecting", useSocketStore.getState().error));
  return s;
}

/** Opens the connection (once; calling it again while connected or connecting does nothing). */
export function connectSocket(): void {
  if (!socketEnabled || !sessionStore.read()?.token) return;
  socket ??= createSocket();
  if (socket.connected || socket.active) return;
  setStatus("connecting");
  socket.connect();
}

/** Closes it (sign-out, or the app unmounting). Listeners stay registered on the socket object until their owners remove them. */
export function disconnectSocket(): void {
  socket?.disconnect();
  setStatus("off");
}

/** Sends an event and resolves with the server's acknowledgement. Rejects when not connected or when the server doesn't answer in time. */
export function emitWithAck<Req, Res>(event: string, payload: Req, timeoutMs = 10_000): Promise<Res> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error("The live connection to the server isn't open. Check your connection and try again."));
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, response: Res) => {
      if (err) reject(new Error("The server didn't answer in time. Nothing was confirmed; try again."));
      else resolve(response);
    });
  });
}

/** Listens for a server event; returns the function that stops listening. The same handler is never attached twice. */
export function onSocketEvent<T>(event: string, handler: (payload: T) => void): () => void {
  socket ??= socketEnabled ? createSocket() : null;
  socket?.off(event, handler);
  socket?.on(event, handler);
  return () => void socket?.off(event, handler);
}
