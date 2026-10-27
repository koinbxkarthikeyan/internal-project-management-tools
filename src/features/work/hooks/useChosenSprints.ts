"use client";

import { useMemo } from "react";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { todayISO } from "@/features/backlog/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useWorkPickStore } from "@/stores/workPickStore";

/** The sprints with dates, and the ones the "What are you working on?" pages show now (the picked sprint, else the running one, else the latest). */
export function useChosenSprints() {
  const { sprints } = useBacklog();
  const picked = useWorkPickStore((s) => s.picked);
  const setPicked = useWorkPickStore((s) => s.setPicked);
  const { isAdmin, isSuperAdmin } = useAuth();
  const showAllClosed = useWorkPickStore((s) => s.showAllClosed);
  // Closed sprints: a Super Admin sees them all, an Admin all of them when switched on, anyone else only the most recently closed one.
  const datedSprints = useMemo(() => {
    const dated = sprints.flatMap((s) => (s.start && s.end ? [{ ...s, start: s.start, end: s.end }] : []));
    const latest = dated.filter((s) => s.status === "Closed").sort((a, b) => (b.closedAt ?? b.end).localeCompare(a.closedAt ?? a.end) || b.end.localeCompare(a.end))[0];
    const allClosed = isSuperAdmin || (isAdmin && showAllClosed);
    // Planned (Paused) sprints are left out: they wait on Sprint plan until someone starts them.
    return dated.filter((s) => s.status !== "Paused" && (s.status !== "Closed" || allClosed || s.id === latest?.id));
  }, [sprints, isAdmin, isSuperAdmin, showAllClosed]);

  const today = todayISO();
  // Default to the running sprint; if none is running, the most recent one.
  const fallback = datedSprints.find((s) => s.status === "Active") ?? datedSprints.find((s) => s.start <= today && today <= s.end) ?? datedSprints[datedSprints.length - 1];
  const wanted = (picked ?? (fallback ? [fallback.id] : [])).filter((id) => datedSprints.some((s) => s.id === id));
  const ids = wanted.length ? wanted : fallback ? [fallback.id] : [];
  const chosen = datedSprints.filter((s) => ids.includes(s.id)).sort((a, b) => a.start.localeCompare(b.start));
  return { datedSprints, chosen, setPicked };
}
