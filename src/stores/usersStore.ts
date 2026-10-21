import { create } from "zustand";
import { STORAGE_KEYS } from "@/constants/auth";
import { getErrorMessage } from "@/lib/apiClient";
import * as userService from "@/services/userService";
import type { AppUser } from "@/types/auth";

/**
 * The one shared copy of the users. `options` is what the pickers need (assignees, lead, who's logging): it is
 * held in memory only (never written to browser storage), and the task list waits for it. `managed` is the Users page's list
 * (Admins only, with last sign-in). Both are reused while fresh, requested once however many components ask, and
 * changed in place after a save. Nothing is kept after signing out.
 */
type Status = "loading" | "ready" | "error";
type Updater<T> = T | ((previous: T) => T);

/** Data younger than this is reused instead of requested again. */
const FRESH_MS = 60_000;

const apply = <T,>(next: Updater<T>, previous: T): T => (typeof next === "function" ? (next as (p: T) => T)(previous) : next);

type State = {
  options: AppUser[];
  optionsAt: number;
  /** Where the picker list stands: "loading" until the first answer, "error" when it failed and there is no list to show. */
  optionsStatus: Status;
  managed: AppUser[];
  managedAt: number;
  managedStatus: Status;
  managedError: string;
  /** Reads the picker list unless it is fresh. A failed read keeps the last list. */
  loadOptions: (force?: boolean) => Promise<void>;
  /** Reads the Users page list unless it is fresh (`quiet`: no loading state). Never throws; a failure keeps the list. */
  loadManaged: (options?: { force?: boolean; quiet?: boolean }) => Promise<void>;
  /** Uses a list another call already read, so the pickers needn't ask again. */
  setOptions: (list: AppUser[]) => void;
  /** Changes the Users page list in place after a save (the pickers follow). */
  setManaged: (next: Updater<AppUser[]>) => void;
  /** Marks the Users page list as old (a user was added from another screen). */
  invalidateManaged: () => void;
  reset: () => void;
};

let optionsInflight: Promise<void> | null = null;
let managedInflight: Promise<void> | null = null;
let generation = 0; // bumped by reset(): an answer that arrives after signing out is dropped

export const useUsersStore = create<State>()(
  (set, get) => ({
    options: [],
    optionsAt: 0,
    optionsStatus: "loading",
    managed: [],
    managedAt: 0,
    managedStatus: "loading",
    managedError: "",

    loadOptions: (force = false) => {
      const s = get();
      if (!force && s.options.length > 0 && Date.now() - s.optionsAt < FRESH_MS) return Promise.resolve();
      if (optionsInflight) return optionsInflight;
      const gen = generation;
      const promise = userService
        .getUserOptions()
        .then((options) => {
          if (gen === generation) set({ options, optionsAt: Date.now(), optionsStatus: "ready", ...(force ? { managedAt: 0 } : {}) });
        })
        .catch(() => {
          // The pickers keep showing the last list; with none to show they say the read failed.
          if (gen === generation && get().options.length === 0) set({ optionsStatus: "error" });
        })
        .finally(() => {
          if (optionsInflight === promise) optionsInflight = null;
        });
      optionsInflight = promise;
      return promise;
    },

    loadManaged: ({ force = false, quiet = false } = {}) => {
      const s = get();
      if (!force && s.managedStatus === "ready" && Date.now() - s.managedAt < FRESH_MS) return Promise.resolve();
      if (managedInflight) return managedInflight;
      if (!quiet && s.managedStatus !== "ready") set({ managedStatus: "loading", managedError: "" });
      const gen = generation;
      const promise = userService
        .getUsers()
        .then(
          (list) => {
            if (gen === generation) set({ managed: list, managedAt: Date.now(), managedStatus: "ready", managedError: "", options: list, optionsAt: Date.now(), optionsStatus: "ready" });
          },
          (err) => {
            if (gen === generation && get().managedStatus !== "ready") set({ managedStatus: "error", managedError: getErrorMessage(err) });
          },
        )
        .finally(() => {
          if (managedInflight === promise) managedInflight = null;
        });
      managedInflight = promise;
      return promise;
    },

    setOptions: (list) => set({ options: list, optionsAt: Date.now(), optionsStatus: "ready" }),
    setManaged: (next) =>
      set((s) => {
        const managed = apply(next, s.managed);
        return { managed, options: managed, optionsAt: Date.now() };
      }),
    invalidateManaged: () => set({ managedAt: 0 }),
    reset: () => {
      generation += 1;
      optionsInflight = null;
      managedInflight = null;
      try {
        localStorage.removeItem(STORAGE_KEYS.users); // a copy an earlier version kept in this browser
      } catch {
        // storage unavailable
      }
      set({ options: [], optionsAt: 0, optionsStatus: "loading", managed: [], managedAt: 0, managedStatus: "loading", managedError: "" });
    },
  }),
);
