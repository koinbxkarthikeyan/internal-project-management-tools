import type { Status } from "@/types/backlog";

/** Before a task is handed to QA (To Do, In Progress, and Blocked or On hold, which sit in To Do) its Tickets section is not shown at all; the Tickets themselves are untouched and come back with the task's later statuses. */
const BEFORE_QA: readonly Status[] = ["Open", "In progress", "Blocked", "On hold"];
export const ticketsVisible = (status: Status): boolean => !BEFORE_QA.includes(status);
