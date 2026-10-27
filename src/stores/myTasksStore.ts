import { create } from "zustand";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";

/**
 * The My Task page's lists (`GET /items/mine`: lead, assigned, unassigned), for every role. It holds which tasks are in which list; the
 * screen shows each one's newest copy from the shared list, so saved changes show at once.
 */
type State = {
  scope: string;
  status: "loading" | "ready" | "error";
  error: string;
  buckets: backlogService.MyTaskBuckets;
  /** Reads the list for this person unless it is already there (`force`: read again). Simultaneous calls share one request. */
  load: (scope: string, force?: boolean) => Promise<void>;
  reset: () => void;
};

const EMPTY: backlogService.MyTaskBuckets = { lead: [], assigned: [], unassigned: [] };

let inflight: { scope: string; promise: Promise<void> } | null = null;

export const useMyTasksStore = create<State>((set, get) => ({
  scope: "",
  status: "loading",
  error: "",
  buckets: EMPTY,

  load: (scope, force = false) => {
    const s = get();
    if (!force && s.scope === scope && s.status === "ready") return Promise.resolve();
    if (inflight?.scope === scope) return inflight.promise;
    if (s.scope !== scope) set({ scope, status: "loading", error: "", buckets: EMPTY });
    else set({ status: "loading", error: "" });
    const promise = backlogService
      .getMyTaskBuckets()
      .then(
        (buckets) => {
          if (get().scope === scope) set({ buckets, status: "ready", error: "" });
        },
        (err) => {
          if (get().scope === scope) set({ status: "error", error: getErrorMessage(err) });
        },
      )
      .finally(() => {
        if (inflight?.promise === promise) inflight = null;
      });
    inflight = { scope, promise };
    return promise;
  },

  reset: () => {
    inflight = null;
    set({ scope: "", status: "loading", error: "", buckets: EMPTY });
  },
}));
