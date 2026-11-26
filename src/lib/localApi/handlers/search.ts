import { db } from "../db";
import { codeOf, requireUser, type Req } from "../core";

/** Quick search: tasks and Tickets by code or title, and people by name (the first few of each). Hidden tasks are not searched. */
export function search({ query }: Req) {
  requireUser();
  const q = String(query.q ?? "").trim().toLowerCase();
  if (!q) return { items: [], people: [] };
  const items = db()
    .items.filter((i) => !i.hidden && (codeOf(i).toLowerCase().includes(q) || i.title.toLowerCase().includes(q)))
    .sort((a, b) => b.id - a.id)
    .slice(0, 8)
    .map((i) => ({ id: i.id, code: codeOf(i), title: i.title, type: i.type, status: i.status, parentId: i.parentId ?? null }));
  const people = db()
    .users.filter((u) => u.accessStatus === "ENABLED" && u.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map((u) => ({ id: u.id, name: u.name, team: u.team ?? null }));
  return { items, people };
}
