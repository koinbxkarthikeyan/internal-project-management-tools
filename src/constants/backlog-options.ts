import type { ItemType, Priority, Status } from "@/types/backlog";

// Fixed option lists for form dropdowns and filters (not application data).
export const PRIORITIES: readonly Priority[] = ["Critical", "High", "Medium", "Low", "Not set"];
export const STATUSES: readonly Status[] = ["Open", "In progress", "Blocked", "On hold", "Completed"];
/** The backend and the app keep the status value "Open"; people see it as "Backlog". */
export const statusLabel = (status: Status): string => (status === "Open" ? "Backlog" : status);
/** Status choices for dropdowns: the saved value with its display label. */
export const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));
export const ITEM_TYPES: readonly ItemType[] = ["Feature", "Enhancement", "Task", "Bug", "Tech Debt"];
