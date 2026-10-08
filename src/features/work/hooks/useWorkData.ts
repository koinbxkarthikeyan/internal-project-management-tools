"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/apiClient";
import * as workService from "@/services/workService";
import type { WorkEntry, WorkEntryInput } from "@/types/work";

type Status = "loading" | "ready" | "error";

const loadAll = () => workService.getWorkEntries().then((entries) => ({ entries }));

/** Loads work entries from the API and exposes their create / update / delete calls (PODs live in the shared backlog state). */
export function useWorkData() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const apply = useCallback((data: { entries: WorkEntry[] }) => {
    setEntries(data.entries);
    setUpdatedAt(new Date());
    setStatus("ready");
  }, []);

  const fail = useCallback((err: unknown) => {
    setError(getErrorMessage(err));
    setStatus("error");
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAll().then(
      (data) => !cancelled && apply(data),
      (err) => !cancelled && fail(err),
    );
    return () => {
      cancelled = true;
    };
  }, [apply, fail]);

  const reload = useCallback(() => {
    setStatus("loading");
    loadAll().then(apply, fail);
  }, [apply, fail]);

  /** Re-fetches in the background without showing the loading skeleton. */
  const refresh = useCallback(() => loadAll().then(apply, (err) => toast.show(getErrorMessage(err), "danger")), [apply, toast]);

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
