"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { addDays, isWeekend } from "@/features/work/utils";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { todayISO } from "../utils";

const SEEN_KEY = "koinbx.sprint-notices";
const NOTICE_MS = 12_000;
/** A closing is announced only while it is recent, so old closed sprints never pop up on a first visit. */
const CLOSED_WINDOW_MS = 7 * 86_400_000;

/** The sprint's last working day: its end date, or the Friday before if it ends on a weekend. */
export function lastWorkingDay(end: string) {
  let day = end;
  for (let i = 0; i < 3 && isWeekend(day); i += 1) day = addDays(day, -1);
  return day;
}

function readSeen(email: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string[]>;
    return all[email] ?? [];
  } catch {
    return [];
  }
}

function markSeen(email: string, keys: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string[]>;
    all[email] = [...new Set([...(all[email] ?? []), ...keys])];
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    // Without storage the notice may show again next time; nothing else depends on it.
  }
}

const names = (value?: string) => (value ?? "").split(",").map((n) => n.trim().replace(/^@+/, "").trim().toLowerCase()).filter(Boolean);

/** Someone is relevant to a sprint when they lead or are assigned one of its tasks. */
function isRelevant(sprint: Sprint, name: string, items: readonly BacklogItemData[]) {
  const me = name.toLowerCase();
  return items.some((t) => t.sprint === sprint.name && ((t.lead ?? "").toLowerCase() === me || names(t.assignees).includes(me)));
}

/**
 * Shows each user two sprint notices, once each:
 * - on the sprint's last working day: "Sprint N ends today. Please complete your pending tasks and update your working hours.";
 * - after it has closed: "Sprint N has been completed and closed."
 * What was already shown is remembered per user in this browser, so nothing repeats.
 */
export default function SprintNotifications() {
  const { status, sprints, items } = useBacklog();
  const { user } = useAuth();
  const toast = useToast();
  const email = user?.email;
  const name = user?.name;

  useEffect(() => {
    if (status !== "ready" || !email || !name) return;
    const today = todayISO();
    const seen = new Set(readSeen(email));

    const due: { key: string; sprint: Sprint; text: string }[] = [];
    for (const s of sprints) {
      if (s.name === "Unplanned") continue;
      const endKey = `ending:${s.id}`;
      const closedKey = `closed:${s.id}`;
      if (s.status === "Active" && s.end && lastWorkingDay(s.end) === today && !seen.has(endKey)) {
        due.push({ key: endKey, sprint: s, text: `${s.name} ends today. Please complete your pending tasks and update your working hours.` });
      }
      if (s.status === "Closed" && s.closedAt && Date.now() - Date.parse(s.closedAt) < CLOSED_WINDOW_MS && !seen.has(closedKey)) {
        due.push({ key: closedKey, sprint: s, text: `${s.name} has been completed and closed.` });
      }
    }
    if (due.length === 0) return;

    const shown: string[] = [];
    for (const d of due) {
      if (!isRelevant(d.sprint, name, items)) continue;
      toast.show(d.text, "info", NOTICE_MS);
      shown.push(d.key);
    }
    if (shown.length) markSeen(email, shown);
  }, [status, sprints, items, email, name, toast]);

  return null;
}
