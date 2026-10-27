import { create } from "zustand";
import { getErrorMessage } from "@/lib/apiClient";
import { refreshUsers } from "@/lib/auth/userStore";
import * as backlogService from "@/services/backlogService";
import * as ownerService from "@/services/ownerService";
import * as podService from "@/services/podService";
import * as sprintService from "@/services/sprintService";
import type { BacklogItemData, Owner, Sprint } from "@/types/backlog";
import type { Pod } from "@/types/work";

/**
 * The one shared copy of the tasks, sprints, PODs and owner records every screen reads. It is loaded once and reused,
 * changed in place after a successful save, and only re-read when it is missing, old, or a change on the server can't
 * be worked out locally (for example the tasks a closed sprint carries over). It holds no passwords or tokens.
 */
export type LoadStatus = "loading" | "ready" | "error";
export type Part = "owners" | "sprints" | "pods" | "items";
type Updater<T> = T | ((previous: T) => T);

/** Who the data is for: it is loaded again when this changes (another user, or a different access level). */
export type LoadContext = { userId: string; restricted: boolean; skip: boolean; /** Read only the first page of tasks (the All Items table loads the rest as it is scrolled). */ lazyItems?: boolean };

/** How far the paged task list has been read. `*Base` is the number of loaded tasks of that side when it was last read, so later local changes still count. */
export type ItemsMeta = { shownTotal: number; hiddenTotal: number; shownBase: number; hiddenBase: number; shownPage: number; hiddenPage: number; shownMore: boolean; hiddenMore: boolean };
const NO_META: ItemsMeta = { shownTotal: 0, hiddenTotal: 0, shownBase: 0, hiddenBase: 0, shownPage: 1, hiddenPage: 1, shownMore: false, hiddenMore: false };

/** Data younger than this is reused instead of requested again. */
const FRESH_MS = 60_000;

const apply = <T,>(next: Updater<T>, previous: T): T => (typeof next === "function" ? (next as (p: T) => T)(previous) : next);
const scopeOf = (c: LoadContext) => `${c.userId}:${c.restricted}:${c.skip}`;
const signature = (sprints: readonly Sprint[]) => sprints.map((s) => `${s.id}:${s.status}:${s.end ?? ""}`).join("|");

type State = {
  status: LoadStatus;
  error: string;
  scope: string;
  loadedAt: number;
  syncedAt: number;
  items: BacklogItemData[];
  /** True when every task is loaded; false while only the first pages of the All Items table are. */
  itemsComplete: boolean;
  itemsMeta: ItemsMeta;
  loadingMore: boolean;
  owners: Owner[];
  sprints: Sprint[];
  pods: Pod[];
  setItems: (next: Updater<BacklogItemData[]>) => void;
  setOwners: (next: Updater<Owner[]>) => void;
  setSprints: (next: Updater<Sprint[]>) => void;
  setPods: (next: Updater<Pod[]>) => void;
  /** Loads everything for this user, unless it is already loaded and fresh. Calls made while one is running share it. */
  load: (ctx: LoadContext, options?: { force?: boolean; quiet?: boolean }) => Promise<void>;
  /** Reads the next page of tasks of one side (shown or hidden) and adds it; nothing while one is loading or there is no more. */
  loadMoreItems: (hidden: boolean, ctx: LoadContext) => Promise<void>;
  /** Reads every task, for the screens that need the whole list (and for a search or filter over the table). */
  completeItems: (ctx: LoadContext) => Promise<void>;
  /** Re-reads only some of the lists after a change that can't be applied locally. Never throws: a failure keeps the data. */
  refreshParts: (parts: Part[], ctx: LoadContext) => Promise<void>;
  /** Cheap check for a sprint that closed by itself: reads the sprints, and the tasks only if the sprints changed. */
  syncSprints: (ctx: LoadContext) => Promise<void>;
};

let inflight: { scope: string; promise: Promise<void> } | null = null;

type Fetched = Partial<Pick<State, "items" | "owners" | "sprints" | "pods" | "itemsComplete" | "itemsMeta">>;

async function fetchParts(parts: readonly Part[], ctx: LoadContext): Promise<Fetched> {
  if (ctx.skip) return {};
  const out: Fetched = {};
  // Owners, sprints, PODs and the users first, so the task list can name them.
  await Promise.all([
    parts.includes("items") && refreshUsers(),
    // Owner records are needed to save a task's owner; only a restricted user (who may not read them) goes on without.
    parts.includes("owners") &&
      ownerService.getOwners().then(
        (v) => void (out.owners = v),
        (err) => {
          if (!ctx.restricted) throw err;
          out.owners = [];
        },
      ),
    parts.includes("sprints") && sprintService.getSprints().then((v) => void (out.sprints = v)),
    parts.includes("pods") && (ctx.restricted ? podService.getPods().catch(() => [] as Pod[]) : podService.getPods()).then((v) => void (out.pods = v)),
  ]);
  if (parts.includes("items")) {
    if (ctx.lazyItems && !ctx.restricted) {
      // Only the first page of each side: 10 tasks, not the whole list.
      const [shown, hidden] = await Promise.all([backlogService.getItemsPage(false, 1), backlogService.getItemsPage(true, 1)]);
      out.items = [...shown.items, ...hidden.items];
      out.itemsComplete = false;
      out.itemsMeta = {
        shownTotal: shown.total,
        hiddenTotal: hidden.total,
        shownBase: shown.items.length,
        hiddenBase: hidden.items.length,
        shownPage: 1,
        hiddenPage: 1,
        shownMore: shown.received >= backlogService.ITEMS_PAGE_SIZE && shown.items.length < shown.total,
        hiddenMore: hidden.received >= backlogService.ITEMS_PAGE_SIZE && hidden.items.length < hidden.total,
      };
    } else {
      out.items = await (ctx.restricted ? backlogService.getMyItems() : backlogService.getItems());
      out.itemsComplete = true;
      out.itemsMeta = NO_META;
    }
  }
  return out;
}

export const useBacklogStore = create<State>((set, get) => ({
  status: "loading",
  error: "",
  scope: "",
  loadedAt: 0,
  syncedAt: 0,
  items: [],
  itemsComplete: true,
  itemsMeta: NO_META,
  loadingMore: false,
  owners: [],
  sprints: [],
  pods: [],

  setItems: (next) => set((s) => ({ items: apply(next, s.items) })),
  setOwners: (next) => set((s) => ({ owners: apply(next, s.owners) })),
  setSprints: (next) => set((s) => ({ sprints: apply(next, s.sprints) })),
  setPods: (next) => set((s) => ({ pods: apply(next, s.pods) })),

  load: (ctx, { force = false, quiet = false } = {}) => {
    const scope = scopeOf(ctx);
    const state = get();
    if (!force && state.scope === scope && state.status === "ready" && Date.now() - state.loadedAt < FRESH_MS) return Promise.resolve();
    if (inflight && inflight.scope === scope) return inflight.promise;

    // Data of another user is dropped; a normal re-read keeps what is shown (no loading flash) unless it is a first load.
    if (state.scope !== scope) set({ scope, status: "loading", error: "", items: [], owners: [], sprints: [], pods: [] });
    else if (!quiet && state.status !== "ready") set({ status: "loading", error: "" });

    const promise = fetchParts(["owners", "sprints", "pods", "items"], ctx).then(
      (data) => {
        if (get().scope === scope) set({ ...data, status: "ready", error: "", loadedAt: Date.now(), syncedAt: Date.now() });
      },
      (err) => {
        if (get().scope === scope && !(quiet && get().status === "ready")) set({ status: "error", error: getErrorMessage(err) });
      },
    ).finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { scope, promise };
    return promise;
  },

  loadMoreItems: async (hidden, ctx) => {
    const state = get();
    const meta = state.itemsMeta;
    if (state.itemsComplete || state.loadingMore || ctx.skip || ctx.restricted || !(hidden ? meta.hiddenMore : meta.shownMore)) return;
    const scope = scopeOf(ctx);
    set({ loadingMore: true });
    try {
      const page = (hidden ? meta.hiddenPage : meta.shownPage) + 1;
      const got = await backlogService.getItemsPage(hidden, page);
      if (get().scope !== scope || get().itemsComplete) return;
      const known = new Set(get().items.map((i) => i.id));
      const fresh = got.items.filter((i) => !known.has(i.id)); // a task already loaded is never added twice
      const next = { ...get().itemsMeta };
      if (hidden) Object.assign(next, { hiddenPage: page, hiddenTotal: got.total });
      else Object.assign(next, { shownPage: page, shownTotal: got.total });
      const items = [...get().items, ...fresh];
      const loaded = (side: boolean) => items.filter((i) => !!i.hidden === side).length;
      next.shownBase = loaded(false);
      next.hiddenBase = loaded(true);
      next[hidden ? "hiddenMore" : "shownMore"] = got.received >= backlogService.ITEMS_PAGE_SIZE && (hidden ? next.hiddenBase < got.total : next.shownBase < got.total);
      set({ items, itemsMeta: next });
    } catch (err) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ loadingMore: false });
    }
  },

  completeItems: async (ctx) => {
    if (get().itemsComplete || ctx.skip) return;
    const scope = scopeOf(ctx);
    try {
      const data = await fetchParts(["items"], { ...ctx, lazyItems: false });
      if (get().scope === scope) set({ ...data });
    } catch {
      // Keep the pages that are loaded; the next try (scroll, filter, other page) reads again.
    }
  },

  refreshParts: async (parts, ctx) => {
    try {
      const data = await fetchParts(parts, ctx);
      if (get().scope === scopeOf(ctx)) set({ ...data, loadedAt: Date.now() });
    } catch {
      // The change itself was saved; if the re-read fails, the next load (focus / reload) picks it up.
      set({ loadedAt: 0 });
    }
  },

  syncSprints: async (ctx) => {
    if (ctx.skip || Date.now() - get().syncedAt < FRESH_MS) return;
    set({ syncedAt: Date.now() });
    try {
      const sprints = await sprintService.getSprints();
      const changed = signature(sprints) !== signature(get().sprints);
      set({ sprints });
      if (changed) await get().refreshParts(["items"], ctx);
    } catch {
      // Keep what is shown.
    }
  },
}));
