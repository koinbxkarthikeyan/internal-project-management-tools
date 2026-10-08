"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";
import { refreshUsers } from "@/lib/auth/userStore";
import * as userService from "@/services/userService";
import type { AppUser } from "@/types/auth";

type Status = "loading" | "ready" | "error";

/** The Users page's list: everyone with their last sign-in, loaded from the backend (Admins only). */
export function useManagedUsers(enabled: boolean) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);

  const load = useCallback(() => userService.getUsers().then(
    (list) => {
      setUsers(list);
      setStatus("ready");
    },
    (err) => {
      setError(getErrorMessage(err));
      setStatus("error");
    },
  ), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    userService.getUsers().then(
      (list) => {
        if (cancelled) return;
        setUsers(list);
        setStatus("ready");
      },
      (err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  /** Re-reads the list after a change (also refreshes the pickers' copy). */
  const reload = useCallback(async () => {
    await Promise.all([load(), refreshUsers()]);
  }, [load]);

  const retry = useCallback(() => {
    setStatus("loading");
    void load();
  }, [load]);

  return { status, error, users, reload, retry };
}
