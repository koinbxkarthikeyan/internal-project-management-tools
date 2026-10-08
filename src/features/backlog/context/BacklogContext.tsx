"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getErrorCode, getErrorMessage, getErrorStatus } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import * as ownerService from "@/services/ownerService";
import * as podService from "@/services/podService";
import * as sprintService from "@/services/sprintService";
import type { BacklogItemData, ItemPatch, NewItemInput, Owner, Sprint, SprintInput } from "@/types/backlog";
import type { Pod } from "@/types/work";

type LoadStatus = "loading" | "ready" | "error";
type SprintResult = "ok" | "empty" | "duplicate" | "locked" | "running" | "error";

type BacklogContextValue = {
  /** Loading state of the initial data fetch. */
  status: LoadStatus;
  error: string;
  reload: () => void;

  /** Items shown in the normal views (not hidden). */
  items: BacklogItemData[];
  /** Items moved to the hidden list; restorable from All items. */
  hiddenItems: BacklogItemData[];
  /** Next free item id, e.g. BLG-111 (preview only; the API assigns the real id). */
  nextId: string;
  addItem: (input: NewItemInput) => Promise<BacklogItemData | null>;
  updateItem: (id: string, patch: ItemPatch) => Promise<boolean>;
  /** What the task's Lead may change from My Task: status, assigned users and the Lead Deadline. */
  leadUpdateItem: (id: string, patch: Pick<ItemPatch, "status" | "assignees" | "leadDeadline">) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  hideItem: (id: string) => Promise<boolean>;
  restoreItem: (id: string) => Promise<boolean>;

  /** Owner names (shared by the Owner dropdowns, filters and Owners & sprints). */
  owners: string[];
  /** Full owner records, including each one's role. */
  ownerRecords: Owner[];
  /** Creates an owner and returns its name; returns the existing name if it already exists, null on failure. */
  addOwner: (name: string, role?: string, team?: string) => Promise<string | null>;

  /** Renames an owner (their items follow). */
  /** `role` / `team`: "" clears it, undefined keeps it. */
  updateOwner: (currentName: string, newName: string, role?: string, team?: string) => Promise<"ok" | "empty" | "duplicate" | "locked" | "error">;
  /** Deletes an owner; their items are moved to "Unassigned". Resolves to the number of items moved, or null on failure. */
  deleteOwner: (name: string) => Promise<number | null>;

  /** The PODs in use (not hidden). Each sprint selects some of them (`sprint.podIds`); a task belongs to one of its sprint's PODs. */
  pods: Pod[];
  /** Every POD including hidden ones, for looking up the name of a POD a task already belongs to. */
  allPods: Pod[];
  /** Creates a POD and returns it; returns the existing POD if the name is taken, null on failure. */
  addPod: (name: string) => Promise<Pod | null>;
  /** Renames a POD everywhere it is used. */
  updatePod: (id: string, name: string) => Promise<"ok" | "empty" | "duplicate" | "error">;
  /** Hides a POD instead of deleting it: its tasks, sprints and logged time are kept, but it leaves every list and choice. */
  hidePod: (id: string) => Promise<boolean>;

  /** All sprints; "Unplanned" is always last. */
  sprints: Sprint[];
  /** The sprint that is running now, if any. Only one sprint can run at a time. */
  activeSprint: Sprint | undefined;
  sprintNames: string[];
  addSprint: (input: SprintInput) => Promise<Exclude<SprintResult, "empty" | "locked">>;
  /** Updates a sprint by its current name; a rename also moves its items. */
  updateSprint: (currentName: string, next: SprintInput) => Promise<SprintResult>;
  /** Adds an existing POD to a sprint's PODs. Only the POD list changes (never the sprint's dates). */
  addPodToSprint: (sprintName: string, podId: string) => Promise<boolean>;
  /** Closes the running sprint (even early); the next one is left Paused. */
  closeSprint: (name: string) => Promise<boolean>;
  /** Starts a Paused sprint (only possible while no other sprint is running). */
  startSprint: (name: string) => Promise<boolean>;
  /** Deletes a sprint; its items move to "Unplanned". Resolves to the number of items moved, or null on failure. */
  deleteSprint: (name: string) => Promise<number | null>;

  createOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
};

type LoadedData = { items: BacklogItemData[]; owners: Owner[]; sprints: Sprint[]; pods: Pod[] };

/**
 * Loads everything the screens share. Owners, sprints and PODs come first so the task list can name them. A user whose
 * access is Disabled may only read their own tasks (`/items/mine`), sprints and PODs, so for them the owner list is
 * left empty if the backend refuses it.
 */
async function loadAll(restricted: boolean): Promise<LoadedData> {
  const soft = <T,>(request: Promise<T>, fallback: T) => (restricted ? request.catch(() => fallback) : request);
  const [owners, sprints, pods] = await Promise.all([
    soft(ownerService.getOwners(), [] as Owner[]),
    sprintService.getSprints(),
    soft(podService.getPods(), [] as Pod[]),
  ]);
  const items = await (restricted ? backlogService.getMyItems() : backlogService.getItems());
  return { items, owners, sprints, pods };
}

const BacklogContext = createContext<BacklogContextValue | null>(null);

export function BacklogProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { restricted } = useAuth();
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState("");
  const [all, setAll] = useState<BacklogItemData[]>([]);
  const [ownerList, setOwnerList] = useState<Owner[]>([]);
  const [rawSprints, setSprints] = useState<Sprint[]>([]);
  const [allPods, setPods] = useState<Pod[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const applyData = useCallback((data: LoadedData) => {
    setAll(data.items);
    setOwnerList(data.owners);
    setSprints(data.sprints);
    setPods(data.pods);
    setStatus("ready");
  }, []);

  const applyFailure = useCallback((err: unknown) => {
    setError(getErrorMessage(err));
    setStatus("error");
  }, []);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    loadAll(restricted).then(
      (data) => !cancelled && applyData(data),
      (err) => !cancelled && applyFailure(err),
    );
    return () => {
      cancelled = true;
    };
  }, [applyData, applyFailure, restricted]);

  const refresh = useCallback(() => loadAll(restricted).then(applyData, applyFailure), [applyData, applyFailure, restricted]);

  // A sprint closes by itself when its end date passes, so pick that up while the page stays open: every few
  // minutes and whenever the tab comes back into view. A failed check is ignored (the page keeps what it has).
  useEffect(() => {
    if (status !== "ready") return;
    const check = () => {
      if (document.visibilityState === "visible") void loadAll(restricted).then(applyData, () => undefined);
    };
    const id = setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [status, applyData, restricted]);

  const reload = useCallback(() => {
    setStatus("loading");
    void refresh();
  }, [refresh]);

  const value = useMemo<BacklogContextValue>(() => {
    const fail = (err: unknown) => toast.show(getErrorMessage(err), "danger");
    const owners = ownerList.map((o) => o.name);
    // The backend has no sprint-to-POD link, so a sprint's PODs are the PODs its tasks are in.
    const sprints = rawSprints.map((s) => ({
      ...s,
      podIds: s.name === "Unplanned" ? [] : [...new Set(all.filter((i) => i.sprint === s.name && i.podId).map((i) => i.podId as string))],
    }));
    const maxId = all.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, "")) || 0), 0);

    const updateItem = async (id: string, patch: ItemPatch) => {
      try {
        const saved = await backlogService.updateItem(id, patch);
        setAll((prev) => prev.map((i) => (i.id === id ? saved : i)));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    };

    return {
      status,
      error,
      reload,

      items: all.filter((i) => !i.hidden),
      hiddenItems: all.filter((i) => i.hidden),
      nextId: `BLG-${maxId + 1}`,
      addItem: async (input) => {
        try {
          const created = await backlogService.createItem(input);
          setAll((prev) => [created, ...prev]);
          return created;
        } catch (err) {
          fail(err);
          return null;
        }
      },
      updateItem,
      leadUpdateItem: async (id, patch) => {
        try {
          const saved = await backlogService.updateItemAsLead(id, patch);
          setAll((prev) => prev.map((i) => (i.id === id ? saved : i)));
          return true;
        } catch (err) {
          fail(err);
          return false;
        }
      },
      deleteItem: async (id) => {
        try {
          await backlogService.deleteItem(id);
          setAll((prev) => prev.filter((i) => i.id !== id));
          return true;
        } catch (err) {
          fail(err);
          return false;
        }
      },
      hideItem: (id) => updateItem(id, { hidden: true }),
      restoreItem: (id) => updateItem(id, { hidden: false }),

      owners,
      ownerRecords: ownerList,
      addOwner: async (raw, role, team) => {
        const name = raw.trim().replace(/\s+/g, " ");
        if (!name) return null;
        const existing = owners.find((o) => o.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        try {
          const created = await ownerService.createOwner({ name, role, team });
          // Keep "Unassigned" last, matching the API's ordering.
          setOwnerList((prev) => {
            const at = prev.findIndex((o) => o.name === "Unassigned");
            return at === -1 ? [...prev, created] : [...prev.slice(0, at), created, ...prev.slice(at)];
          });
          return created.name;
        } catch (err) {
          if (getErrorStatus(err) === 409) {
            // Created elsewhere in the meantime; refresh and use the existing owner.
            void refresh();
            return name;
          }
          fail(err);
          return null;
        }
      },

      updateOwner: async (currentName, raw, role, team) => {
        const current = ownerList.find((o) => o.name === currentName);
        const name = raw.trim().replace(/\s+/g, " ");
        if (!current || currentName === "Unassigned") return "locked";
        if (!name) return "empty";
        try {
          const saved = await ownerService.updateOwner(current.id, { name, role, team });
          setOwnerList((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
          if (saved.name !== currentName) {
            setAll((prev) => prev.map((i) => (i.owner === currentName ? { ...i, owner: saved.name } : i)));
          }
          return "ok";
        } catch (err) {
          const code = getErrorStatus(err);
          if (code === 409) return "duplicate";
          if (code === 403) return "locked";
          fail(err);
          return "error";
        }
      },
      deleteOwner: async (name) => {
        const current = ownerList.find((o) => o.name === name);
        if (!current || name === "Unassigned") return null;
        try {
          await ownerService.deleteOwner(current.id);
          setOwnerList((prev) => prev.filter((o) => o.id !== current.id));
          const moved = all.filter((i) => i.owner === name).length;
          setAll((prev) => prev.map((i) => (i.owner === name ? { ...i, owner: "Unassigned" } : i)));
          return moved;
        } catch (err) {
          fail(err);
          return null;
        }
      },

      pods: allPods.filter((p) => !p.hidden),
      allPods,
      addPod: async (raw) => {
        const name = raw.trim().replace(/\s+/g, " ");
        if (!name) return null;
        const existing = allPods.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (existing?.hidden) {
          // Adding a hidden POD again brings it back.
          try {
            const saved = await podService.updatePod(existing.id, { hidden: false });
            setPods((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            return saved;
          } catch (err) {
            fail(err);
            return null;
          }
        }
        if (existing) return existing;
        try {
          const created = await podService.createPod({ name });
          setPods((prev) => [...prev, created]);
          return created;
        } catch (err) {
          if (getErrorStatus(err) === 409) {
            void refresh();
            return null;
          }
          fail(err);
          return null;
        }
      },

      updatePod: async (id, raw) => {
        const name = raw.trim().replace(/\s+/g, " ");
        if (!name) return "empty";
        try {
          const saved = await podService.updatePod(id, { name });
          setPods((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
          return "ok";
        } catch (err) {
          if (getErrorStatus(err) === 409) return "duplicate";
          fail(err);
          return "error";
        }
      },
      hidePod: async (id) => {
        try {
          const saved = await podService.updatePod(id, { hidden: true });
          setPods((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
          return true;
        } catch (err) {
          fail(err);
          return false;
        }
      },

      sprints,
      activeSprint: sprints.find((s) => s.name !== "Unplanned" && s.status === "Active"),
      sprintNames: sprints.map((s) => s.name),
      // Kept for the screens that still call it: the backend links a POD to a sprint only through the tasks in it,
      // so there is nothing to save here (the POD shows under the sprint once a task is created in it).
      addPodToSprint: async (sprintName) => sprints.some((s) => s.name === sprintName),
      closeSprint: async (name) => {
        const current = sprints.find((s) => s.name === name);
        if (!current) return false;
        try {
          const saved = await sprintService.updateSprint(current.id, { status: "Closed" });
          setSprints((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
          // Closing leaves the next sprint Paused and copies the unfinished tasks into it, so reload everything.
          await refresh();
          return true;
        } catch (err) {
          fail(err);
          return false;
        }
      },
      startSprint: async (name) => {
        const target = sprints.find((s) => s.name === name);
        if (!target) return false;
        try {
          await sprintService.startSprint(target.id);
          await refresh();
          return true;
        } catch (err) {
          fail(err);
          return false;
        }
      },
      addSprint: async (input) => {
        try {
          const created = await sprintService.createSprint(input);
          setSprints((prev) => {
            const at = prev.findIndex((s) => s.name === "Unplanned");
            return at === -1 ? [...prev, created] : [...prev.slice(0, at), created, ...prev.slice(at)];
          });
          // The backend fixes the end date (start + 2 weeks) and may carry tasks over: take its version.
          void refresh();
          return "ok";
        } catch (err) {
          if (getErrorCode(err) === "sprint_running") return "running";
          if (getErrorStatus(err) === 409) return "duplicate";
          fail(err);
          return "error";
        }
      },
      deleteSprint: async (name) => {
        const current = sprints.find((s) => s.name === name);
        if (!current || name === "Unplanned") return null;
        try {
          await sprintService.deleteSprint(current.id);
          setSprints((prev) => prev.filter((s) => s.id !== current.id));
          const moved = all.filter((i) => i.sprint === name).length;
          setAll((prev) => prev.map((i) => (i.sprint === name ? { ...i, sprint: "Unplanned", podId: undefined } : i)));
          void refresh();
          return moved;
        } catch (err) {
          fail(err);
          return null;
        }
      },
      updateSprint: async (currentName, next) => {
        const current = sprints.find((s) => s.name === currentName);
        if (!current || currentName === "Unplanned") return "locked";
        if (!next.name.trim()) return "empty";
        try {
          const saved = await sprintService.updateSprint(current.id, next);
          setSprints((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
          if (saved.name !== currentName) {
            setAll((prev) => prev.map((i) => (i.sprint === currentName ? { ...i, sprint: saved.name } : i)));
          }
          // Tasks whose POD was removed from the sprint lose it on the server: pick that up.
          void refresh();
          return "ok";
        } catch (err) {
          const code = getErrorStatus(err);
          if (code === 409) return "duplicate";
          if (code === 403) return "locked";
          fail(err);
          return "error";
        }
      },

      createOpen,
      openCreate: () => setCreateOpen(true),
      closeCreate: () => setCreateOpen(false),
    };
  }, [status, error, reload, all, ownerList, rawSprints, allPods, createOpen, toast, refresh]);

  return <BacklogContext.Provider value={value}>{children}</BacklogContext.Provider>;
}

export function useBacklog() {
  const ctx = useContext(BacklogContext);
  if (!ctx) throw new Error("useBacklog must be used within BacklogProvider");
  return ctx;
}
