"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLiveTaskUpdates } from "../hooks/useLiveTaskUpdates";
import { resolveTeam, useTeamStore } from "@/stores/teamStore";
import { useWorkStore } from "@/stores/workStore";
import { useBacklogStore } from "@/stores/backlogStore";
import { getErrorCode, getErrorMessage, getErrorStatus } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import * as ownerService from "@/services/ownerService";
import * as podService from "@/services/podService";
import * as sprintService from "@/services/sprintService";
import type { BacklogItemData, ItemPatch, NewItemInput, Owner, Sprint, SprintInput, Status } from "@/types/backlog";
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
  /** My Task, normal users: a status change with the required work details (BACKEND-DEPENDENT, see backlogService.changeStatusWithDetails). */
  changeStatusWithDetails: (id: string, status: Status, details: string) => Promise<boolean>;
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

const EMPTY_ITEMS: BacklogItemData[] = [];
const EMPTY_OWNERS: Owner[] = [];
const EMPTY_SPRINTS: Sprint[] = [];
const EMPTY_PODS: Pod[] = [];

/** Tasks whose save is in flight. */
const savingItems = new Set<string>();

const BacklogContext = createContext<BacklogContextValue | null>(null);

export function BacklogProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { restricted, settingsOnly, user } = useAuth();
  // The shared copy of the data lives in the store (src/stores/backlogStore.ts); this provider reads it and saves into it.
  const scopeKey = `${user?.id ?? ""}:${restricted}:${settingsOnly}`;
  // Data that was loaded for someone else (or another access level) is never shown: until this user's load starts, it is "loading".
  const mine = useBacklogStore((st) => st.scope === scopeKey);
  const storeStatus = useBacklogStore((st) => st.status);
  const status = mine ? storeStatus : "loading";
  const error = useBacklogStore((st) => st.error);
  const all = useBacklogStore((st) => (st.scope === scopeKey ? st.items : EMPTY_ITEMS));
  const apiOwners = useBacklogStore((st) => (st.scope === scopeKey ? st.owners : EMPTY_OWNERS));
  const rawSprints = useBacklogStore((st) => (st.scope === scopeKey ? st.sprints : EMPTY_SPRINTS));
  const allPods = useBacklogStore((st) => (st.scope === scopeKey ? st.pods : EMPTY_PODS));
  const { setItems: setAll, setOwners: setOwnerList, setSprints, setPods, load, refreshParts, syncSprints } = useBacklogStore.getState();
  const ctx = useMemo(() => ({ userId: user?.id ?? "", restricted, skip: settingsOnly }), [user?.id, restricted, settingsOnly]);
  const [createOpen, setCreateOpen] = useState(false);

  // Owners are their own records (not users); "Unassigned" is added last.
  const teamRenames = useTeamStore((st) => st.renames);
  // Owner teams follow team renames too.
  const ownerList = useMemo(() => ownerService.withUnassigned(apiOwners.map((o) => (o.team ? { ...o, team: resolveTeam(o.team, teamRenames) } : o))), [apiOwners, teamRenames]);

  // Initial load. Mounting again (or another component asking) reuses the data while it is fresh.
  useEffect(() => {
    void load(ctx);
  }, [ctx, load]);

  // Status changes saved by other people arrive live (only when a socket URL is configured; see src/lib/socketClient.ts).
  useLiveTaskUpdates(status === "ready");

  // A sprint closes by itself when its end date passes, so check the sprints now and then (every few minutes, and when the
  // tab comes back into view). Only if they changed are the tasks read again.
  useEffect(() => {
    if (status !== "ready") return;
    const check = () => {
      if (document.visibilityState === "visible") void syncSprints(ctx);
    };
    const id = setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [status, ctx, syncSprints]);

  const reload = useCallback(() => void load(ctx, { force: true }), [ctx, load]);

  const value = useMemo<BacklogContextValue>(() => {
    const fail = (err: unknown) => toast.show(getErrorMessage(err), "danger");
    const owners = ownerList.map((o) => o.name);
    // The backend has no sprint-to-POD link, so a sprint's PODs are the PODs its tasks are in.
    const sprints = rawSprints.map((s) => ({
      ...s,
      podIds: s.name === "Unplanned" ? [] : [...new Set(all.filter((i) => i.sprint === s.name && i.podId).map((i) => i.podId as string))],
    }));
    const maxId = all.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, "")) || 0), 0);

    // A task of a closed sprint is history: it can be viewed but not changed, hidden or deleted.
    const lockedBySprint = (id: string) => {
      const sprint = all.find((i) => i.id === id)?.sprint;
      const closed = !!sprint && rawSprints.some((s) => s.name === sprint && s.status === "Closed");
      if (closed) toast.show(`${sprint} is closed, so its tasks can only be viewed.`, "danger");
      return closed;
    };

    const updateItem = async (id: string, patch: ItemPatch) => {
      if (lockedBySprint(id)) return false;
      if (savingItems.has(id)) return false; // already being saved: a repeated click must not send it twice
      savingItems.add(id);
      try {
        const saved = await backlogService.updateItem(id, patch);
        setAll((prev) => prev.map((i) => (i.id === id ? saved : i)));
        return true;
      } catch (err) {
        fail(err);
        return false;
      } finally {
        savingItems.delete(id);
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
        if (lockedBySprint(id)) return false;
        try {
          const saved = await backlogService.updateItemAsLead(id, patch);
          setAll((prev) => prev.map((i) => (i.id === id ? saved : i)));
          return true;
        } catch (err) {
          fail(err);
          return false;
        }
      },
      changeStatusWithDetails: async (id, status, details) => {
        if (lockedBySprint(id)) return false;
        try {
          const saved = await backlogService.changeStatusWithDetails(id, status, details);
          setAll((prev) => prev.map((i) => (i.id === id ? saved : i)));
          return true;
        } catch (err) {
          fail(err);
          return false;
        }
      },
      deleteItem: async (id) => {
        if (lockedBySprint(id)) return false;
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
          setOwnerList((prev) => [...prev, created]);
          return created.name;
        } catch (err) {
          if (getErrorStatus(err) === 409) {
            // Created elsewhere in the meantime; refresh and use the existing owner.
            void refreshParts(["owners"], ctx);
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
            void refreshParts(["pods"], ctx);
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
          // Closing leaves the next sprint Paused and copies the unfinished tasks into it: re-read just those two lists.
          await refreshParts(["sprints", "items"], ctx);
          useWorkStore.setState({ loadedAt: 0 }); // a sprint closed: the time logs are read again next time
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
          await refreshParts(["sprints"], ctx);
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
          void refreshParts(["sprints", "items"], ctx);
          useWorkStore.setState({ loadedAt: 0 });
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
          useWorkStore.setState({ loadedAt: 0 }); // the sprint's time logs are gone
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
          // A new start date moves the end date, which the backend works out: take its version of the sprints.
          if (next.start && next.start !== current.start) void refreshParts(["sprints"], ctx);
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
  }, [status, error, reload, all, ownerList, rawSprints, allPods, createOpen, toast, ctx, refreshParts, setAll, setPods, setSprints, setOwnerList]);

  return <BacklogContext.Provider value={value}>{children}</BacklogContext.Provider>;
}

export function useBacklog() {
  const ctx = useContext(BacklogContext);
  if (!ctx) throw new Error("useBacklog must be used within BacklogProvider");
  return ctx;
}
