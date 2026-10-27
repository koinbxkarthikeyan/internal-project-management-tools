import type { ItemType, Priority, Status } from "@/types/backlog";

// Fixed option lists for form dropdowns and filters (not application data).
export const PRIORITIES: readonly Priority[] = ["Critical", "High", "Medium", "Low", "Not set"];
export const STATUSES: readonly Status[] = ["Open", "In progress", "Blocked", "On hold", "Completed"];
/** The backend and the app keep the status value "Open"; people see it as "To Do" (work not started). "Backlog" is the place for tasks in no sprint, not a status. */
export const statusLabel = (status: Status): string => (status === "Open" ? "To Do" : status);
/** The stored sprint name "Unplanned" (tasks in no sprint) is shown to people as "Backlog". */
export const sprintLabel = (name: string): string => (name === "Unplanned" ? "Backlog" : name);
/** Status choices for dropdowns: the saved value with its display label. */
export const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));
export const ITEM_TYPES: readonly ItemType[] = ["Feature", "Enhancement", "Task", "Bug", "Tech Debt"];
