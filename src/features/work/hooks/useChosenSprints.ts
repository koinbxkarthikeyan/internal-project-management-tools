"use client";

import { useMemo } from "react";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { todayISO } from "@/features/backlog/utils";
import { useWorkPickStore } from "@/stores/workPickStore";

/** The sprints with dates, and the ones the "What are you working on?" pages show now (the picked sprint, else the running one, else the latest). */
export function useChosenSprints() {
  const { sprints } = useBacklog();
  const picked = useWorkPickStore((s) => s.picked);
  const setPicked = useWorkPickStore((s) => s.setPicked);
  const datedSprints = useMemo(() => sprints.flatMap((s) => (s.start && s.end ? [{ ...s, start: s.start, end: s.end }] : [])), [sprints]);

  const today = todayISO();
  // Default to the running sprint; if none is running, the most recent one.
  const fallback = datedSprints.find((s) => s.status === "Active") ?? datedSprints.find((s) => s.start <= today && today <= s.end) ?? datedSprints[datedSprints.length - 1];
  const wanted = (picked ?? (fallback ? [fallback.id] : [])).filter((id) => datedSprints.some((s) => s.id === id));
  const ids = wanted.length ? wanted : fallback ? [fallback.id] : [];
  const chosen = datedSprints.filter((s) => ids.includes(s.id)).sort((a, b) => a.start.localeCompare(b.start));
  return { datedSprints, chosen, setPicked };
}
