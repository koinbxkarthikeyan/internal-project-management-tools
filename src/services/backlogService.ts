import { apiClient } from "@/lib/apiClient";
import type { BacklogItemData, ItemPatch, NewItemInput } from "@/types/backlog";
import {
  apiIdForCode,
  itemFromApi,
  list,
  listFrom,
  priorityToApi,
  rec,
  rememberItem,
  rememberItems,
  sprintIdByName,
  statusToApi,
  typeToApi,
  userIdByName,
  ownerIdByName,
} from "./mappers";

type Rec = Record<string, unknown>;

/** Every page of `/items` for one side of the hidden switch (the backend pages at 200). */
async function fetchPages(hidden: boolean): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data } = await apiClient.get<unknown>("/items", { params: { hidden, page, limit: 200 } });
    const rows = listFrom(data, "items").flatMap((r) => (rec(r) ? [rec(r)!] : []));
    out.push(...rows);
    const total = Number(rec(data)?.total ?? rows.length);
    if (rows.length === 0 || out.length >= total) break;
  }
  return out;
}

function toItems(rows: Rec[]): BacklogItemData[] {
  const codeById = new Map(rows.flatMap((r) => (typeof r.code === "string" ? [[Number(r.id), r.code] as [number, string]] : [])));
  const items = rows.map((r) => itemFromApi(r, codeById));
  rememberItems(items);
  return items;
}

/** All tasks, shown and hidden. */
export async function getItems(): Promise<BacklogItemData[]> {
  const [shown, hidden] = await Promise.all([fetchPages(false), fetchPages(true)]);
  const seen = new Set<unknown>();
  return toItems([...shown, ...hidden].filter((r) => !seen.has(r.id) && seen.add(r.id)));
}

/** For users whose access is Disabled: only the tasks they lead, are assigned to, or that nobody owns (`/items/mine`). */
export async function getMyItems(): Promise<BacklogItemData[]> {
  const { data } = await apiClient.get<unknown>("/items/mine");
  const rows = [...list(rec(data)?.lead), ...list(rec(data)?.assigned), ...list(rec(data)?.unassigned)].flatMap((r) => (rec(r) ? [rec(r)!] : []));
  const seen = new Set<unknown>();
  return toItems(rows.filter((r) => !seen.has(r.id) && seen.add(r.id)));
}

/** One task with its activity and what the signed-in user may do with it (`canLeadEdit`, `readOnly`). */
export async function getItem(id: string, options: { force?: boolean } = {}): Promise<BacklogItemData> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error(`Task ${id} isn't loaded`);
  const cached = detail.get(apiId);
  if (!options.force && cached && (cached.promise || Date.now() - cached.at < DETAIL_FRESH_MS)) return cached.promise ?? Promise.resolve(cached.item as BacklogItemData);
  return fetchItem(apiId);
}

// Opening the same task again (panel, history view) reuses what was just read, and calls made at the same moment share
// one request. A save refreshes the entry; a delete drops it.
const DETAIL_FRESH_MS = 30_000;
const detail = new Map<number, { at: number; item?: BacklogItemData; promise?: Promise<BacklogItemData> }>();

function fetchItem(apiId: number): Promise<BacklogItemData> {
  const promise = apiClient.get<Rec>(`/items/${apiId}`).then(({ data }) => {
    const item = itemFromApi(data);
    rememberItem(item);
    detail.set(apiId, { at: Date.now(), item });
    return item;
  }, (err) => {
    detail.delete(apiId);
    throw err;
  });
  detail.set(apiId, { at: Date.now(), promise });
  return promise;
}

/** Create-and-update bodies use ids, so names are turned back into ids here. Only the fields given are sent. */
function bodyFrom(input: ItemPatch): Rec {
  const body: Rec = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.priority !== undefined) body.priority = priorityToApi(input.priority);
  if (input.type !== undefined) body.type = typeToApi(input.type);
  if (input.status !== undefined) body.status = statusToApi(input.status);
  if (input.deadline !== undefined) body.expectedDeadline = input.deadline || null;
  if (input.completed !== undefined) body.completedAt = input.completed || null;
  if (input.owner !== undefined && input.owner !== "Unassigned") {
    const ownerId = ownerIdByName(input.owner);
    // Not sent as a guess: the owner has to be an owner record on the backend, otherwise the old owner would stay.
    if (ownerId === undefined) throw new Error(`${input.owner} has no owner record on the backend yet, so they can't be set as the owner.`);
    body.ownerId = ownerId;
  }
  if (input.sprint !== undefined) body.sprintId = input.sprint === "Unplanned" ? null : (sprintIdByName(input.sprint) ?? null);
  if (input.podId !== undefined || input.sprint === "Unplanned") body.podId = input.podId ? Number(input.podId) : null;
  if (input.lead !== undefined) body.leadId = input.lead ? (userIdByName(input.lead) ?? null) : null;
  if (input.assignees !== undefined) {
    body.assigneeIds = input.assignees
      .split(",")
      .map((n) => n.trim().replace(/^@+/, "").trim())
      .filter(Boolean)
      .flatMap((n) => {
        const id = userIdByName(n);
        return id === undefined ? [] : [id];
      });
  }
  return body;
}

/** Saves a new task. The backend gives it its code (BLG-n). */
export async function createItem(input: NewItemInput): Promise<BacklogItemData> {
  const body = bodyFrom(input);
  body.type = typeToApi(input.type);
  delete body.status; // a new task starts Open; the backend sets that
  delete body.completedAt;
  if (body.ownerId === undefined) body.ownerId = ownerIdByName(input.owner);
  const { data } = await apiClient.post<Rec>("/items", body);
  const item = itemFromApi(data);
  rememberItem(item);
  return item;
}

/** Changes a task by its code. `hidden` goes to the visibility call; everything else to the task. */
export async function updateItem(id: string, patch: ItemPatch): Promise<BacklogItemData> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error(`Task ${id} isn't loaded`);
  const { hidden, ...rest } = patch;
  const body = bodyFrom(rest);
  if (Object.keys(body).length) await apiClient.patch(`/items/${apiId}`, body);
  if (hidden !== undefined) await apiClient.patch(`/items/${apiId}/visibility`, { hidden });
  return fetchItem(apiId);
}

/** What the task's Lead may change from My Task: status, assigned users, and the Lead Deadline. */
export async function updateItemAsLead(id: string, patch: Pick<ItemPatch, "status" | "assignees" | "leadDeadline">): Promise<BacklogItemData> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error(`Task ${id} isn't loaded`);
  const body: Rec = {};
  if (patch.status !== undefined) body.status = statusToApi(patch.status);
  if (patch.assignees !== undefined) body.assigneeIds = (bodyFrom({ assignees: patch.assignees }).assigneeIds as number[]) ?? [];
  if (patch.leadDeadline !== undefined) body.leadDeadline = patch.leadDeadline || null;
  await apiClient.patch(`/items/${apiId}/lead`, body);
  return fetchItem(apiId);
}

export async function deleteItem(id: string): Promise<void> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error(`Task ${id} isn't loaded`);
  await apiClient.delete(`/items/${apiId}`);
  detail.delete(apiId);
}
