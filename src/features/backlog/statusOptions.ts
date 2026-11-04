import { STATUS_OPTIONS } from "@/constants/backlog-options";
import type { BacklogItemData } from "@/types/backlog";

/** What a task in the Backlog (in no sprint) may be changed to: To Do, On Hold or Blocked. */
const BACKLOG_STATUSES = ["Open", "On hold", "Blocked"] as const;

const HIDDEN_FROM_MEMBERS: readonly string[] = ["Done", "Testing", "Blocked", "On hold"];

/**
 * The one list every status dropdown uses (the Edit panel, and the Lead's panel on My Task / My Lead). A Backlog task is offered only To Do, On Hold and Blocked;
 * its current status stays in the list when it is something else (an older In progress or Done one), so the field still shows it and nothing else is offered.
 * (A Ticket has its own rule, below.) Tasks in a sprint keep every status (without Done unless `canFinish`; QA, who may complete what is Ready for QA, passes `canComplete` to be offered Testing and Done too).
 */
export function statusOptionsFor(task: Pick<BacklogItemData, "sprint" | "status"> & Partial<Pick<BacklogItemData, "type">>, canFinish = true, canComplete = canFinish, ownTicket = false) {
  // A Ticket: its people (the task's Lead and Assigned Users, the Ticket's assignee) may set any status except Done, which is QA's, the
  // admins' and that of the person who created the Ticket (their own only). The status it has stays in the list.
  if (task.type === "Ticket") {
    return STATUS_OPTIONS.filter((o) => o.value !== "Ready for QA" || o.value === task.status).filter(
      (o) => o.value === task.status || (o.value === "Done" ? canComplete || ownTicket : true),
    );
  }
  // Only Super Admin and enabled Admins may mark a task Done; everyone else hands it on with Ready for QA. A task already Done keeps showing it.
  // They are not offered Blocked or On hold either.
  const hidden = canComplete ? HIDDEN_FROM_MEMBERS.filter((s) => s !== "Done" && s !== "Testing") : HIDDEN_FROM_MEMBERS;
  const offered = canFinish ? STATUS_OPTIONS : STATUS_OPTIONS.filter((o) => !hidden.includes(o.value) || o.value === task.status);
  if (task.sprint !== "Unplanned") return offered;
  // A Backlog task is offered To Do, On Hold and Blocked; the people who cannot finish tasks get To Do only.
  const allowed: readonly string[] = canFinish ? BACKLOG_STATUSES : ["Open"];
  return offered.filter((o) => allowed.includes(o.value) || o.value === task.status);
}
