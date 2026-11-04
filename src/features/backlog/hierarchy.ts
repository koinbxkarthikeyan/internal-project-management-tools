import type { BacklogItemData, ItemType } from "@/types/backlog";

/**
 * Backlog task, then Bug, then Ticket. A top-level task (Feature, Enhancement, Task, Tech Debt) has no parent; a Bug may sit under one; a Ticket sits directly
 * under a task (how QA works in Ready for QA) or under a Bug, and holds nothing. The data layer enforces the same rules when a task is saved.
 */
export const isBug = (t?: ItemType) => t === "Bug";
export const isTicket = (t?: ItemType) => t === "Ticket";
export const hasParentField = (t?: ItemType) => isBug(t) || isTicket(t);

/** The tasks a task of this type may be put under. */
export function parentChoices(type: ItemType | undefined, items: readonly BacklogItemData[], selfId?: string): BacklogItemData[] {
  if (!hasParentField(type)) return [];
  // A Ticket may go under any task or Bug; a Bug under a top-level task.
  return items.filter((i) => i.id !== selfId && !isTicket(i.type) && (isTicket(type) || !isBug(i.type)));
}

/** What a task's parent is called in the form. */
export const parentLabel = () => "Parent task";

/** The tasks directly under a task, and all those below it. */
export const childrenOf = (code: string, items: readonly BacklogItemData[]) => items.filter((i) => i.parent === code);
export const descendantsOf = (code: string, items: readonly BacklogItemData[]): BacklogItemData[] => childrenOf(code, items).flatMap((c) => [c, ...descendantsOf(c.id, items)]);
