import { apiClient, getErrorStatus } from "@/lib/apiClient";
import { sessionStore } from "@/lib/auth/sessionStore";
import type { WorkEntry, WorkEntryInput, WorkEntryPatch } from "@/types/work";
import { OTHER_WORK_PREFIX, apiIdForCode, directory, entryFromApi, kindToApi, list, rec } from "./mappers";

type Rec = Record<string, unknown>;

const rows = (v: unknown): Rec[] => list(v).flatMap((r) => (rec(r) ? [rec(r)!] : []));

/** The signed-in user's own time logs in one sprint (`/work-entries/my-sprint`). Closed sprints come back read-only. */
async function myEntries(sprintId: string): Promise<WorkEntry[]> {
  const me = sessionStore.read()?.user.name ?? "";
  const meId = sessionStore.read()?.user.id;
  const { data } = await apiClient.get<unknown>("/work-entries/my-sprint", { params: { sprintId: Number(sprintId) } });
  return rows(rec(data)?.entries).map((r) => entryFromApi(r, { sprintId, person: me, ...(meId ? { personId: meId } : {}) }));
}

/**
 * A team-view line may name its task in several ways (a list, one id or code, a task object, or just its title). It is turned
 * into the `items` list the entry mapper reads, so the hours land on that task (and its POD) instead of on no task at all.
 */
function lineAsEntry(r: Rec): Rec {
  if (r.itemIds ?? r.items ?? r.tasks) return r;
  const code = [r.taskCode, r.itemCode, r.code].find((c) => typeof c === "string");
  const title = [r.task, r.taskTitle, r.title].find((t): t is string => typeof t === "string" && !!t.trim());
  const byTitle = title ? [...directory.itemsByCode.values()].find((t) => t.title.trim().toLowerCase() === title.trim().toLowerCase()) : undefined;
  const one = r.taskId ?? r.itemId ?? rec(r.task) ?? rec(r.item) ?? (code ? { code } : byTitle ? { code: byTitle.id } : undefined);
  return one != null ? { ...r, items: [one] } : r;
}

/**
 * Everyone's time logs in one sprint, taken from the team view (`/work-entries/everyone`), which groups them by
 * person. A person's group is read for its entries when the backend includes them.
 */
async function teamEntries(sprintId: string): Promise<WorkEntry[]> {
  const { data } = await apiClient.get<unknown>("/work-entries/everyone", { params: { sprintId: Number(sprintId) } });
  const root = rec(data);
  // One group per person (under `byPerson`, or `people` / `users` / `groups`), each with that person's entries; a flat list of entries that name their person is read too.
  const groups = rows(root?.byPerson ?? root?.people ?? root?.users ?? root?.groups);
  const grouped = groups.flatMap((group) => {
    const who = rec(group.person) ?? rec(group.user);
    const person = typeof who?.name === "string" ? who.name : String(group.name ?? group.label ?? group.person ?? "");
    const personId = who?.id ?? group.userId;
    // `lines` are the person's logged rows; one without an id of its own is keyed by person, sprint and position so it can't collide.
    return rows(group.entries ?? group.lines ?? group.logs ?? group.timeLogs ?? group.workEntries).map((r, i) =>
      entryFromApi(lineAsEntry(r.id == null ? { ...r, id: `${sprintId}:${personId ?? person}:${i}` } : r), { sprintId, person, ...(personId != null ? { personId: String(personId) } : {}) }),
    );
  });
  const flat = rows(root?.entries ?? root?.workEntries).map((r) => entryFromApi(r, { sprintId }));
  // A row with no date is not a logged entry (e.g. a summary line); showing it would add an empty "0h" record to that person.
  return [...grouped, ...flat].filter((e) => e.from && e.to);
}

/**
 * Every time log the screens need: the signed-in user's own plus, where the team view provides them, everyone else's.
 * Sprints are read one by one, because the backend scopes these calls to a sprint. A sprint that can't be read
 * (for example a team view the user may not open) is skipped rather than failing the page.
 */
// A closed sprint can't change any more, so what was read for it is kept (per signed-in user) and not asked for again.
const closedCache = new Map<string, WorkEntry[]>();

export type LoadedWork = {
  entries: WorkEntry[];
  /** The server refused (403) or does not offer (404) the team view for at least one sprint, so other people's entries may be missing. */
  teamUnavailable: boolean;
};

export async function getWorkEntries(): Promise<LoadedWork> {
  const me = sessionStore.read()?.user.id ?? "";
  let teamUnavailable = false;
  const perSprint = await Promise.all(
    directory.sprints.map(async ({ id, status }) => {
      const key = `${me}:${id}`;
      const kept = status === "Closed" ? closedCache.get(key) : undefined;
      if (kept) return kept;
      // The person's own entries must load: a failure is an error for the page, never "no hours". The team view may be
      // refused for some roles (403 / 404); only that is tolerated, any other failure is reported too.
      const notAllowed = (err: unknown) => {
        const code = getErrorStatus(err);
        if (code === 403 || code === 404) {
          teamUnavailable = true;
          return null;
        }
        throw err;
      };
      const [mine, team] = await Promise.all([myEntries(id), teamEntries(id).catch(notAllowed)]);
      const entries = [...(team ?? []), ...mine];
      if (status === "Closed" && team) closedCache.set(key, entries);
      return entries;
    }),
  );
  const seen = new Set<string>();
  const unique = perSprint.flat().filter((e) => !seen.has(e.id) && seen.add(e.id));
  // A team-view line has no id of its own (ours is built, and contains ":"). When the same person's real entry with the same
  // sprint, dates and hours exists, the line is that entry again and is dropped, so hours are not counted twice.
  const sameWork = (a: WorkEntry, b: WorkEntry) => a.person === b.person && a.sprintId === b.sprintId && a.from === b.from && a.to === b.to && a.hours === b.hours;
  const real = unique.filter((e) => !e.id.includes(":"));
  return { entries: unique.filter((e) => !e.id.includes(":") || !real.some((r) => sameWork(r, e))), teamUnavailable };
}

function bodyFrom(input: WorkEntryPatch): Rec {
  const body: Rec = {};
  // Other work links no task; the backend keeps only a note, so the description is saved as "Other work: …" ahead of any notes.
  if (input.otherWork) {
    body.itemIds = [];
    body.note = [`${OTHER_WORK_PREFIX}${(input.task ?? "").trim()}`, input.notes?.trim()].filter(Boolean).join("\n");
  } else if (input.itemIds !== undefined) body.itemIds = input.itemIds.flatMap((code) => {
    const id = apiIdForCode(code);
    return id === undefined ? [] : [id];
  });
  if (input.kind !== undefined) body.kind = kindToApi(input.kind);
  if (input.from !== undefined) body.fromDate = input.from;
  if (input.to !== undefined) body.toDate = input.to;
  if (input.hours !== undefined) body.hours = input.hours;
  if (input.notes !== undefined && !input.otherWork) body.note = input.notes;
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
