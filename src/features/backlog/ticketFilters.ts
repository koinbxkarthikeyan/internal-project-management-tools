import { teamId } from "@/lib/auth/teams";
import type { BacklogItemData, Priority, Status } from "@/types/backlog";

/** The Tickets filters. Teams and people are matched by their ids (a team's id is its cleaned, lower-case name; a user's is the user id), never by how a name is spelled. "" means any. */
export type TicketFilters = { search: string; createdBy: string; assignedTo: string; status: "" | Status; priority: "" | Priority };
export const NO_TICKET_FILTERS: TicketFilters = { search: "", createdBy: "", assignedTo: "", status: "", priority: "" };

export const isFiltering = (f: TicketFilters) => Object.values(f).some((v) => v !== "");

/** The Ticket's assignee (a Ticket has one) and the creator's team and the assignee's team as ids; a missing team is "". */
export const ticketAssigneeId = (t: BacklogItemData) => t.assigneeIds?.[0] ?? "";

/** Every filter given must match (they combine), and the search matches the Ticket id or any part of its title. */
export function filterTickets(tickets: readonly BacklogItemData[], f: TicketFilters): BacklogItemData[] {
  const q = f.search.trim().toLowerCase();
  return tickets.filter(
    (t) =>
      (!q || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)) &&
      (!f.createdBy || t.createdById === f.createdBy) &&
      (!f.assignedTo || ticketAssigneeId(t) === f.assignedTo) &&
      (!f.status || t.status === f.status) &&
      (!f.priority || t.priority === f.priority),
  );
}

/** How a task's Tickets are grouped: by the team they are assigned to, by the team of the person who created them, or not at all. */
export type TicketGroupBy = "" | "assigned" | "created";
export const GROUP_OPTIONS: readonly { value: TicketGroupBy; label: string }[] = [
  { value: "", label: "No grouping" },
  { value: "assigned", label: "Assigned team" },
  { value: "created", label: "Created by team" },
];

/** The Tickets in one section per team (teams in name order, "No team" last); within a team they keep their order. Teams are told apart by id, so spelling and case do not split one. */
export function groupTickets(tickets: readonly BacklogItemData[], by: TicketGroupBy): { key: string; name: string; tickets: BacklogItemData[] }[] {
  if (!by) return [{ key: "", name: "", tickets: [...tickets] }];
  const groups = new Map<string, { key: string; name: string; tickets: BacklogItemData[] }>();
  for (const t of tickets) {
    const team = by === "assigned" ? t.assignedTeam : t.createdByTeam;
    const key = team ? teamId(team) : "";
    (groups.get(key) ?? groups.set(key, { key, name: team ?? "No team", tickets: [] }).get(key)!).tickets.push(t);
  }
  return [...groups.values()].sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : a.name.localeCompare(b.name)));
}
