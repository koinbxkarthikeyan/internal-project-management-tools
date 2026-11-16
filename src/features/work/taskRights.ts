import type { AppUser } from "@/types/auth";
import type { BacklogItemData } from "@/types/backlog";

/**
 * What the signed-in person may change on a task from My Task: the Lead (as the backend says, else by name) may change the status, assignees and Developer ETA; an assigned user (not the Lead)
 * may change the status and Developer ETA; nobody may on a read-only task, in a closed sprint, or in a details-only view. The Developer ETA is entered once; after that only an admin changes it.
 * `item` should be the task completed by its own detail (the lists leave the Lead and assignees out).
 */
export function taskRights({ item, user, isAdmin, sprintClosed = false, viewOnly = false }: { item: BacklogItemData; user: Pick<AppUser, "id" | "name"> | null | undefined; isAdmin: boolean; sprintClosed?: boolean; viewOnly?: boolean }) {
  const blocked = viewOnly || sprintClosed || !!item.readOnly;
  const byName = !!item.lead && user?.name.toLowerCase() === item.lead.toLowerCase();
  const isLead = !blocked && (item.canLeadEdit ?? byName);
  const isAssignee =
    !isLead && !blocked && !!user && ((item.assigneeIds ?? []).map(String).includes(String(user.id)) || (item.assignees ?? "").split(",").some((n) => n.trim().toLowerCase() === user.name.toLowerCase()));
  return { isLead, isAssignee, canEdit: isLead || isAssignee, etaLocked: !isAdmin && !!item.leadDeadline };
}
