import { create } from "zustand";
import { NOTIFICATIONS_WS_URL, NOTIFICATIONS_WS_URL_INVALID } from "./config";

/** "unconfigured": no WebSocket address is set, so there is no live connection (the list still comes from REST). */
export type ConnectionStatus = "unconfigured" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

type State = {
  status: ConnectionStatus;
  /** A short reason for the last failure, when there is one. */
  detail: string;
  set: (status: ConnectionStatus, detail?: string) => void;
};

/** What the bell shows about the live connection. */
export const useNotificationConnection = create<State>((set) => ({
  status: NOTIFICATIONS_WS_URL ? "disconnected" : "unconfigured",
  detail: NOTIFICATIONS_WS_URL_INVALID ? "The configured WebSocket address is not a ws:// or wss:// address." : "",
  set: (status, detail = "") => set({ status, detail }),
}));
