import { apiClient } from "@/lib/apiClient";
import { statusFromApi, list, rec } from "./mappers";
import type { Status } from "@/types/backlog";

export type FoundItem = { id: number; code: string; title: string; isTicket: boolean; status: Status; parentId: number | null };
export type FoundPerson = { id: string; name: string; team?: string };
export type Found = { items: FoundItem[]; people: FoundPerson[] };

/** Tasks, Tickets and people matching what was typed (code, title or name). */
export async function searchAll(q: string): Promise<Found> {
  const { data } = await apiClient.get<unknown>("/search", { params: { q } });
  const d = rec(data) ?? {};
  return {
    items: list(d.items).map((raw) => {
      const i = rec(raw) ?? {};
      return { id: Number(i.id), code: String(i.code ?? ""), title: String(i.title ?? ""), isTicket: String(i.type) === "TICKET", status: statusFromApi(i.status), parentId: i.parentId == null ? null : Number(i.parentId) };
    }),
    people: list(d.people).map((raw) => {
      const u = rec(raw) ?? {};
      return { id: String(u.id), name: String(u.name ?? ""), ...(u.team ? { team: String(u.team) } : {}) };
    }),
  };
}
