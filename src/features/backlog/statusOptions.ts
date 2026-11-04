import { STATUS_OPTIONS } from "@/constants/backlog-options";
import type { BacklogItemData } from "@/types/backlog";

/** What a task in the Backlog (in no sprint) may be changed to: To Do, On Hold or Blocked. */
const BACKLOG_STATUSES = ["Open", "On hold", "Blocked"] as const;

/**
 * The one list every status dropdown uses (the Edit panel, and the Lead's panel on My Task / My Lead). A Backlog task is offered only To Do, On Hold and Blocked;
 * its current status stays in the list when it is something else (an older In progress or Completed one), so the field still shows it and nothing else is offered.
 * Tasks in a sprint keep every status.
 */
export function statusOptionsFor(task: Pick<BacklogItemData, "sprint" | "status">) {
  if (task.sprint !== "Unplanned") return STATUS_OPTIONS;
  return STATUS_OPTIONS.filter((o) => (BACKLOG_STATUSES as readonly string[]).includes(o.value) || o.value === task.status);
}
