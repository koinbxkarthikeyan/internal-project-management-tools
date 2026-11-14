import { create } from "zustand";
import { getErrorMessage } from "@/lib/apiClient";
import * as leaveService from "@/services/leaveService";
import type { PersonalLeave } from "@/services/leaveService";

export type { PersonalLeave };

/**
 * The signed-in person's own leave days, read from and saved to the backend (`/work-entries/leaves`); nothing is kept in the browser.
 * A sprint's common leave is not here: it is part of the sprint (`Sprint.commonLeaves`).
 */
type LeaveState = {
  personal: PersonalLeave[];
  /** Reads the leave days of the given sprints (replacing what was held for them). */
  load: (sprintIds: readonly string[], me: string) => Promise<void>;
  /** Each returns an error text, or undefined when saved. */
  add: (sprintId: string, me: string, dates: readonly { date: string; hours?: number }[]) => Promise<string | undefined>;
  remove: (id: string, sprintId: string, me: string) => Promise<string | undefined>;
  clear: () => void;
};

export const useLeaveStore = create<LeaveState>()((set, get) => ({
  personal: [],
  load: async (sprintIds, me) => {
    const results = await Promise.allSettled(sprintIds.map((id) => leaveService.getLeaves(id, me)));
    set((s) => {
      const fresh = new Set(sprintIds.filter((_, i) => results[i].status === "fulfilled"));
      return { personal: [...s.personal.filter((p) => !fresh.has(p.sprintId)), ...results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))] };
    });
  },
  add: async (sprintId, me, dates) => {
    const failures: string[] = [];
    let saved = 0;
    for (const d of dates) {
      try {
        await leaveService.addLeave(sprintId, d.date, d.hours);
        saved++;
      } catch (err) {
        failures.push(getErrorMessage(err));
      }
    }
    if (saved) await get().load([sprintId], me);
    return saved === 0 ? failures[0] ?? "Couldn't save the leave." : undefined;
  },
  remove: async (id, sprintId, me) => {
    try {
      await leaveService.removeLeave(id);
      await get().load([sprintId], me);
    } catch (err) {
      return getErrorMessage(err);
    }
  },
  clear: () => set({ personal: [] }),
}));

/** The hours off per date in one sprint for one person: the sprint's common leave (whole days) plus their own; a date on both is one date (the larger, never more than a day). */
export function offDaysOf(common: readonly { date: string }[], personal: readonly PersonalLeave[], sprintId: string, userId?: string): Map<string, number> {
  const FULL_DAY = 6;
  const off = new Map<string, number>();
  const put = (date: string, hours?: number) => off.set(date, Math.min(FULL_DAY, Math.max(off.get(date) ?? 0, hours ?? FULL_DAY)));
  for (const c of common) put(c.date);
  if (userId) for (const p of personal) if (p.sprintId === sprintId && p.userId === userId) put(p.date, p.hours);
  return off;
}
