"use client";

import { useMemo } from "react";
import { resolveTeam, useTeamStore } from "@/stores/teamStore";
import { useUsersStore } from "@/stores/usersStore";
import type { AppUser } from "@/types/auth";

/** The users for the pickers (from the shared users store); empty on the server render. Team names follow team renames. */
export function useUsers(): AppUser[] {
  const users = useUsersStore((s) => s.options);
  const renames = useTeamStore((s) => s.renames);
  return useMemo(() => users.map((u) => (u.team ? { ...u, team: resolveTeam(u.team, renames) } : u)), [users, renames]);
}
