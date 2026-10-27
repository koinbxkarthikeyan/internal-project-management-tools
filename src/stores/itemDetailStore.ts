import { create } from "zustand";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData } from "@/types/backlog";
import { useBacklogStore } from "./backlogStore";

/**
 * The detail of a task (`/items/:id`: its activity and what the signed-in person may change). It is read when a task is
 * opened and reused while fresh, so opening View again, or the history of a task that was just viewed, doesn't ask
 * again. Any change to the shared tasks drops it, so a saved change is never shown with an old activity list.
 */
const FRESH_MS = 60_000;

type State = {
  details: Record<string, { item: BacklogItemData; at: number }>;
  /** The task's detail: from memory while fresh, else read (simultaneous calls for one task share one request). Rejects on failure. */
  get: (id: string) => Promise<BacklogItemData>;
  clear: () => void;
};

const inflight = new Map<string, Promise<BacklogItemData>>();
let generation = 0;

export const useItemDetailStore = create<State>((set, get) => ({
  details: {},

  get: (id) => {
    const kept = get().details[id];
    if (kept && Date.now() - kept.at < FRESH_MS) return Promise.resolve(kept.item);
    const running = inflight.get(id);
    if (running) return running;
    const gen = generation;
    const promise = backlogService
      .getItem(id)
      .then((item) => {
        if (gen === generation) set((s) => ({ details: { ...s.details, [id]: { item, at: Date.now() } } }));
        return item;
      })
      .finally(() => {
        if (inflight.get(id) === promise) inflight.delete(id);
      });
    inflight.set(id, promise);
    return promise;
  },

  clear: () => {
    generation += 1;
    inflight.clear();
    set({ details: {} });
  },
}));

// The tasks changed (saved, deleted, re-read): what was read for them is no longer trusted.
let lastItems = useBacklogStore.getState().items;
useBacklogStore.subscribe((s) => {
  if (s.items === lastItems) return;
  lastItems = s.items;
  if (Object.keys(useItemDetailStore.getState().details).length > 0 || inflight.size > 0) useItemDetailStore.getState().clear();
});
