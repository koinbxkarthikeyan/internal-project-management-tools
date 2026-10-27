"use client";

import { useCallback, useEffect, useMemo } from "react";
import { resolveTeam, useTeamStore } from "@/stores/teamStore";
import { useUsersStore } from "@/stores/usersStore";

/** The Users page's list: everyone with their last sign-in, from the shared users store (Admins only). Opening the page again reuses it while fresh. */
export function useManagedUsers(enabled: boolean) {
  const status = useUsersStore((s) => s.managedStatus);
  const error = useUsersStore((s) => s.managedError);
  const users = useUsersStore((s) => s.managed);
  const { loadManaged } = useUsersStore.getState();

  useEffect(() => {
    if (enabled) void loadManaged();
  }, [enabled, loadManaged]);

  /** Re-reads the list after a change made elsewhere (the pickers' copy comes from the same read). */
  const reload = useCallback(() => loadManaged({ force: true, quiet: true }), [loadManaged]);
  const retry = useCallback(() => loadManaged({ force: true }), [loadManaged]);

  const renames = useTeamStore((s) => s.renames);
  const shown = useMemo(() => users.map((u) => (u.team ? { ...u, team: resolveTeam(u.team, renames) } : u)), [users, renames]);

  return { status, error, users: shown, reload, retry };
}
