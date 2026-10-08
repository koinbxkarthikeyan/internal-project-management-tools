import type { ItemType, Priority, Status } from "@/types/backlog";

// Fixed option lists for form dropdowns and filters (not application data).
export const PRIORITIES: readonly Priority[] = ["Critical", "High", "Medium", "Low", "Not set"];
export const STATUSES: readonly Status[] = ["Open", "In progress", "Blocked", "On hold", "Completed"];
export const ITEM_TYPES: readonly ItemType[] = ["Feature", "Enhancement", "Task", "Bug", "Tech Debt"];
