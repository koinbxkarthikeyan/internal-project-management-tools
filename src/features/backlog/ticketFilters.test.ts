import { describe, expect, it } from "vitest";
import type { BacklogItemData } from "@/types/backlog";
import { NO_TICKET_FILTERS, filterTickets, groupTickets, isFiltering, ticketAssignees } from "./ticketFilters";

const t = (over: Partial<BacklogItemData>) => ({ id: "TKT-001", title: "Login fails", status: "Open", priority: "High", createdById: "1", assigneeIds: [], ...over }) as unknown as BacklogItemData;

const tickets = [
  t({ id: "TKT-001", title: "Login fails", createdById: "1", assigneeIds: ["10"], assignees: "Mayil", assignedTeam: "Mobile", createdByTeam: "QA", status: "Open", priority: "High" }),
  t({ id: "TKT-002", title: "Crash on save", createdById: "2", assigneeIds: ["10", "11"], assignees: "Mayil, Sasi", assignedTeam: "Mobile", createdByTeam: "QA", status: "In progress", priority: "Low" }),
  t({ id: "TKT-003", title: "Typo", createdById: "2", assigneeIds: [], createdByTeam: "Product", status: "Open", priority: "Low" }),
];
const ids = (list: BacklogItemData[]) => list.map((x) => x.id);

describe("filterTickets", () => {
  it("keeps everything when nothing is filtered", () => {
    expect(isFiltering(NO_TICKET_FILTERS)).toBe(false);
    expect(ids(filterTickets(tickets, NO_TICKET_FILTERS))).toEqual(["TKT-001", "TKT-002", "TKT-003"]);
  });

  it("searches the id and any part of the title, ignoring case", () => {
    expect(ids(filterTickets(tickets, { ...NO_TICKET_FILTERS, search: "tkt-002" }))).toEqual(["TKT-002"]);
    expect(ids(filterTickets(tickets, { ...NO_TICKET_FILTERS, search: "SAVE" }))).toEqual(["TKT-002"]);
  });

  it("matches Assigned To against every assignee of a Ticket", () => {
    expect(ids(filterTickets(tickets, { ...NO_TICKET_FILTERS, assignedTo: "10" }))).toEqual(["TKT-001", "TKT-002"]);
    expect(ids(filterTickets(tickets, { ...NO_TICKET_FILTERS, assignedTo: "11" }))).toEqual(["TKT-002"]);
  });

  it("combines the filters (all must match)", () => {
    expect(ids(filterTickets(tickets, { ...NO_TICKET_FILTERS, createdBy: "2", priority: "Low", status: "Open" }))).toEqual(["TKT-003"]);
  });
});

describe("ticketAssignees", () => {
  it("pairs each assignee id with the name at the same place", () => {
    expect(ticketAssignees(tickets[1])).toEqual([["10", "Mayil"], ["11", "Sasi"]]);
    expect(ticketAssignees(tickets[2])).toEqual([]);
  });
});

describe("groupTickets", () => {
  it("is one section when not grouped", () => {
    expect(groupTickets(tickets, "")).toHaveLength(1);
  });

  it("groups by the team of the first assignee, teams in name order and No team last", () => {
    const groups = groupTickets(tickets, "assigned");
    expect(groups.map((g) => g.name)).toEqual(["Mobile", "No team"]);
    expect(ids(groups[0].tickets)).toEqual(["TKT-001", "TKT-002"]);
  });

  it("groups by the creator's team, telling teams apart by id (case and spacing do not split one)", () => {
    const more = [...tickets, t({ id: "TKT-004", createdByTeam: " qa ", createdById: "3" })];
    const groups = groupTickets(more, "created");
    expect(groups.map((g) => g.name)).toEqual(["Product", "QA"]);
    expect(ids(groups[1].tickets)).toEqual(["TKT-001", "TKT-002", "TKT-004"]);
  });
});
