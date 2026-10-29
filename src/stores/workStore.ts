import { create } from "zustand";
import { getErrorMessage } from "@/lib/apiClient";
import * as workService from "@/services/workService";
import type { WorkEntry } from "@/types/work";

/**
 * The shared copy of the logged work entries (for My Sprint and the sprint history views). Loaded once per user and
 * reused while fresh; a create / change / delete is applied to it in place instead of reading everything again.
 */
type Status = "loading" | "ready" | "error";
type Updater<T> = T | ((previous: T) => T);

const FRESH_MS = 60_000;
const apply = <T,>(next: Updater<T>, previous: T): T => (typeof next === "function" ? (next as (p: T) => T)(previous) : next);

type State = {
  status: Status;
  error: string;
  scope: string;
  loadedAt: number;
  updatedAt: Date | null;
  entries: WorkEntry[];
  /** The server did not give the team view, so other people's entries may be missing. */
  teamUnavailable: boolean;
  setEntries: (next: Updater<WorkEntry[]>) => void;
  /** Loads the entries unless they are already loaded and fresh; simultaneous calls share one request. */
  load: (userId: string, options?: { force?: boolean; quiet?: boolean }) => Promise<void>;
};

let inflight: { scope: string; promise: Promise<void> } | null = null;

export const useWorkStore = create<State>((set, get) => ({
  status: "loading",
  error: "",
  scope: "",
  loadedAt: 0,
  updatedAt: null,
  entries: [],
  teamUnavailable: false,

  setEntries: (next) => set((s) => ({ entries: apply(next, s.entries) })),

  load: (userId, { force = false, quiet = false } = {}) => {
    const state = get();
    if (!force && state.scope === userId && state.status === "ready" && Date.now() - state.loadedAt < FRESH_MS) return Promise.resolve();
    if (inflight && inflight.scope === userId) return inflight.promise;

    if (state.scope !== userId) set({ scope: userId, status: "loading", error: "", entries: [], teamUnavailable: false, updatedAt: null });
    else if (!quiet && state.status !== "ready") set({ status: "loading", error: "" });

    const promise = workService
      .getWorkEntries()
      .then(
        ({ entries, teamUnavailable }) => {
          if (get().scope === userId) set({ entries, teamUnavailable, status: "ready", error: "", loadedAt: Date.now(), updatedAt: new Date() });
        },
        (err) => {
          // A failed background refresh keeps what is shown (the caller reports it); a failed first load is an error state.
          if (get().scope === userId && get().status !== "ready") set({ status: "error", error: getErrorMessage(err) });
          throw err;
        },
      )
      .finally(() => {
        if (inflight?.promise === promise) inflight = null;
      });
    inflight = { scope: userId, promise };
    return promise;
  },
}));
