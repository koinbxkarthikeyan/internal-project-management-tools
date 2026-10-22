import type { WorkKind } from "@/types/work";

// Fixed option lists and planning settings for the "What are you working on?" section (not application data).
export const WORK_KINDS: readonly WorkKind[] = ["Backend", "Frontend", "Mobile", "Testing", "Design"];

/** Focus hours the team plans per working day. */
export const FOCUS_HOURS_PER_DAY = 6;

export const HOUR_PRESETS = [
  { label: "1h", hours: 1 },
  { label: "2h", hours: 2 },
  { label: "Half a day", hours: FOCUS_HOURS_PER_DAY / 2 },
  { label: "A day", hours: FOCUS_HOURS_PER_DAY },
] as const;

export const WORK_HREF = "/my-sprint";
export const WORK_LOGGED_HREF = "/my-sprint/logged";
export const MY_TASK_HREF = "/my-task";

/**
 * Stands in for a POD when time is logged against Unplanned Tasks (tasks that aren't in any POD).
 * It is never saved as a real POD.
 */
export const UNPLANNED_POD = { id: "__unplanned__", name: "Unplanned" } as const;

/** Stands in for a POD when time is logged against tasks that are in the sprint but in no POD. Never saved as a real POD. */
export const SPRINT_TASKS_POD = { id: "__sprint-tasks__", name: "Sprint tasks" } as const;

/** True for the stand-ins above (no real POD behind them). */
export const isPseudoPod = (id: string | undefined) => id === UNPLANNED_POD.id || id === SPRINT_TASKS_POD.id;
