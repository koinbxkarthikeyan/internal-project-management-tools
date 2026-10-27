import type { Sprint } from "@/types/backlog";

/**
 * The rules for moving a task between sprint sections, with no screen in them. Sections run top to bottom as the Sprint plan shows them:
 * the running sprint, the planned sprints in their order, then the Backlog ("Unplanned", the tasks in no sprint). A closed sprint is never a section.
 */
export const BACKLOG_SECTION = "Unplanned";

export function orderedSections(sprints: readonly Sprint[]): string[] {
  const open = sprints.filter((s) => s.name !== BACKLOG_SECTION && s.status !== "Closed");
  return [...open.filter((s) => s.status === "Active"), ...open.filter((s) => s.status !== "Active")].map((s) => s.name).concat(BACKLOG_SECTION);
}

/** May a task be put in this section? The Backlog and any sprint that is not closed; never a closed (or unknown) sprint. */
export function canReceive(sprints: readonly Sprint[], section: string): boolean {
  return section === BACKLOG_SECTION || sprints.some((s) => s.name === section && s.status !== "Closed");
}
