import { STATUS_OPTIONS } from "@/constants/backlog-options";
import { isQaTeam } from "@/lib/auth/qaTeam";
import type { BacklogItemData } from "@/types/backlog";

/** What a task in the Backlog (in no sprint) may be changed to: To Do, On Hold or Blocked. */
const BACKLOG_STATUSES = ["Open", "On hold", "Blocked"] as const;

const HIDDEN_FROM_MEMBERS: readonly string[] = ["Done", "Testing", "Blocked", "On hold"];

/**
 * The one list every status dropdown uses (the Edit panel, and the Lead's panel on My Task / My Lead). A Backlog task is offered only To Do, On Hold and Blocked;
 * its current status stays in the list when it is something else (an older In progress or Done one), so the field still shows it and nothing else is offered.
 * (A Ticket has its own rule, below.) Tasks in a sprint keep every status (without Done unless `canFinish`; QA, who may complete what is Ready for QA, passes `canComplete` to be offered Testing and Done too).
 */
export function statusOptionsFor(task: Pick<BacklogItemData, "sprint" | "status"> & Partial<Pick<BacklogItemData, "type" | "createdByTeam">>, canFinish = true, canComplete = canFinish, ownTicket = false) {
  // A Ticket: the person who created it (their own Ticket), QA and the admins may set any status. Everyone else on it (the task's Lead and Assigned Users, the Ticket's assignee) hands it
  // to QA with Ready for QA and cannot go further (Testing, Done); on a Ticket that QA created they also cannot set Blocked or On hold. Once it is with QA (Ready for QA, Testing, Done)
  // only QA, the admins and its creator move it on. The status it has stays in the list.
  if (task.type === "Ticket") {
    if (canComplete || ownTicket) return STATUS_OPTIONS;
    const withQa = task.status === "Ready for QA" || task.status === "Testing" || task.status === "Done";
    const heldBack: readonly string[] = isQaTeam(task.createdByTeam) ? ["Testing", "Done", "Blocked", "On hold"] : ["Testing", "Done"];
    return STATUS_OPTIONS.filter((o) => o.value === task.status || (!withQa && !heldBack.includes(o.value)));
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
