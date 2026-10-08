import { apiClient } from "@/lib/apiClient";
import { sessionStore } from "@/lib/auth/sessionStore";
import type { WorkEntry, WorkEntryInput, WorkEntryPatch } from "@/types/work";
import { apiIdForCode, directory, entryFromApi, kindToApi, list, rec } from "./mappers";

type Rec = Record<string, unknown>;

const rows = (v: unknown): Rec[] => list(v).flatMap((r) => (rec(r) ? [rec(r)!] : []));

/** The signed-in user's own time logs in one sprint (`/work-entries/my-sprint`). Closed sprints come back read-only. */
async function myEntries(sprintId: string): Promise<WorkEntry[]> {
  const me = sessionStore.read()?.user.name ?? "";
  const { data } = await apiClient.get<unknown>("/work-entries/my-sprint", { params: { sprintId: Number(sprintId) } });
  return rows(rec(data)?.entries).map((r) => entryFromApi(r, { sprintId, person: me }));
}

/**
 * Everyone's time logs in one sprint, taken from the team view (`/work-entries/everyone`), which groups them by
 * person. A person's group is read for its entries when the backend includes them.
 */
async function teamEntries(sprintId: string): Promise<WorkEntry[]> {
  const { data } = await apiClient.get<unknown>("/work-entries/everyone", { params: { sprintId: Number(sprintId) } });
  return rows(rec(data)?.byPerson).flatMap((group) => {
    const who = rec(group.person) ?? rec(group.user);
    const person = typeof who?.name === "string" ? who.name : String(group.name ?? group.label ?? group.person ?? "");
    return rows(group.entries ?? group.logs ?? group.timeLogs).map((r) => entryFromApi(r, { sprintId, person }));
  });
}

/**
 * Every time log the screens need: the signed-in user's own plus, where the team view provides them, everyone else's.
 * Sprints are read one by one, because the backend scopes these calls to a sprint. A sprint that can't be read
 * (for example a team view the user may not open) is skipped rather than failing the page.
 */
export async function getWorkEntries(): Promise<WorkEntry[]> {
  const sprintIds = directory.sprints.map((s) => s.id);
  const perSprint = await Promise.all(
    sprintIds.map(async (id) => {
      const [mine, team] = await Promise.all([myEntries(id).catch(() => []), teamEntries(id).catch(() => [])]);
      return [...team, ...mine];
    }),
  );
  const seen = new Set<string>();
  return perSprint.flat().filter((e) => !seen.has(e.id) && seen.add(e.id));
}

function bodyFrom(input: WorkEntryPatch): Rec {
  const body: Rec = {};
  if (input.itemIds !== undefined) body.itemIds = input.itemIds.flatMap((code) => {
    const id = apiIdForCode(code);
    return id === undefined ? [] : [id];
  });
  if (input.kind !== undefined) body.kind = kindToApi(input.kind);
  if (input.from !== undefined) body.fromDate = input.from;
  if (input.to !== undefined) body.toDate = input.to;
  if (input.hours !== undefined) body.hours = input.hours;
  if (input.notes !== undefined) body.note = input.notes;
  return body;
}

export async function createWorkEntry(input: WorkEntryInput): Promise<WorkEntry> {
  const { data } = await apiClient.post<Rec>("/work-entries", { sprintId: Number(input.sprintId), ...bodyFrom(input) });
  return entryFromApi(data, { ...input, createdAt: new Date().toISOString() });
}

export async function updateWorkEntry(id: string, patch: WorkEntryPatch): Promise<WorkEntry> {
  const { data } = await apiClient.patch<Rec>(`/work-entries/${encodeURIComponent(id)}`, bodyFrom(patch));
  return entryFromApi({ id, ...(rec(data) ?? {}) }, { ...patch, id } as Partial<WorkEntry>);
}

export async function deleteWorkEntry(id: string): Promise<void> {
  await apiClient.delete(`/work-entries/${encodeURIComponent(id)}`);
}
