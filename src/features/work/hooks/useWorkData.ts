"use client";

import { useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/features/auth/hooks/useAuth";
import * as workService from "@/services/workService";
import { useWorkStore } from "@/stores/workStore";
import type { WorkEntryInput } from "@/types/work";

/** Reads the shared work entries (src/stores/workStore.ts) and exposes their create / update / delete calls (PODs live in the shared backlog state). */
export function useWorkData() {
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const status = useWorkStore((st) => st.status);
  const error = useWorkStore((st) => st.error);
  const entries = useWorkStore((st) => st.entries);
  const updatedAt = useWorkStore((st) => st.updatedAt);
  const { setEntries, load } = useWorkStore.getState();

  // Mounting My Sprint again reuses the entries while they are fresh; the first load shows the skeleton.
  useEffect(() => {
    load(userId).catch(() => undefined);
  }, [userId, load]);

  const reload = useCallback(() => {
    load(userId, { force: true }).catch(() => undefined);
  }, [userId, load]);

  /** Re-fetches in the background without showing the loading skeleton. */
  const refresh = useCallback(
    () => load(userId, { force: true, quiet: true }).catch((err) => toast.show(getErrorMessage(err), "danger")),
    [userId, load, toast],
  );

  const report = (err: unknown) => toast.show(getErrorMessage(err), "danger");

  return {
    status,
    error,
    reload,
    refresh,
    updatedAt,
    entries,

    addEntry: async (input: WorkEntryInput): Promise<boolean> => {
      try {
        const created = await workService.createWorkEntry(input);
        setEntries((prev) => [...prev, created]);
        return true;
      } catch (err) {
        report(err);
        return false;
      }
    },
    updateEntry: async (id: string, input: WorkEntryInput): Promise<boolean> => {
      try {
        const saved = await workService.updateWorkEntry(id, input);
        setEntries((prev) => prev.map((e) => (e.id === id ? saved : e)));
        return true;
      } catch (err) {
        report(err);
        return false;
      }
    },
    removeEntry: async (id: string): Promise<boolean> => {
      try {
        await workService.deleteWorkEntry(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
        return true;
      } catch (err) {
        report(err);
        return false;
      }
    },
  };
}
