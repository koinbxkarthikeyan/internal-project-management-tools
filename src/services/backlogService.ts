import { apiClient } from "@/lib/apiClient";
import { SOCKET_EVENTS } from "@/constants/socketEvents";
import { emitWithAck, socketEnabled } from "@/lib/socketClient";
import type { BacklogItemData, ItemPatch, NewItemInput, Status } from "@/types/backlog";
import type { ChangeStatusAck, ChangeStatusRequest } from "@/types/socket";
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

/** The page size of the All Items table: it loads this many tasks at a time. */
export const ITEMS_PAGE_SIZE = 10;

/** One page of `/items` for one side of the hidden switch, with how many tasks that side has in all. */
export async function getItemsPage(hidden: boolean, page: number, limit = ITEMS_PAGE_SIZE): Promise<{ items: BacklogItemData[]; total: number; received: number }> {
  const { data } = await apiClient.get<unknown>("/items", { params: { hidden, page, limit } });
  const rows = listFrom(data, "items").flatMap((r) => (rec(r) ? [rec(r)!] : []));
  const codeById = new Map(rows.flatMap((r) => (typeof r.code === "string" ? [[Number(r.id), r.code] as [number, string]] : [])));
  const items = rows.map((r) => itemFromApi(r, codeById));
  items.forEach(rememberItem); // added to what the services remember (the full list replaces it, a page only adds)
  return { items, total: Number(rec(data)?.total ?? rows.length), received: rows.length };
}

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

function toItems(rows: Rec[], remember = true): BacklogItemData[] {
  const codeById = new Map(rows.flatMap((r) => (typeof r.code === "string" ? [[Number(r.id), r.code] as [number, string]] : [])));
  const items = rows.map((r) => itemFromApi(r, codeById));
  if (remember) rememberItems(items);
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

/** The three lists `GET /items/mine` answers with, each as tasks. A task may be in more than one (e.g. one I lead and am assigned to). */
export type MyTaskBuckets = { lead: BacklogItemData[]; assigned: BacklogItemData[]; unassigned: BacklogItemData[] };

/**
 * The My Task page's lists, kept as the server sends them: `lead`, `assigned` and `unassigned`. Unlike `getMyItems` it doesn't replace
 * the shared task directory (that belongs to the full list), so an Admin's other screens keep working. A task listed twice in one
 * list appears once in it.
 */
export async function getMyTaskBuckets(): Promise<MyTaskBuckets> {
  const { data } = await apiClient.get<unknown>("/items/mine");
  const rowsOf = (key: string): Rec[] => {
    const seen = new Set<unknown>();
    return list(rec(data)?.[key]).flatMap((r) => (rec(r) && !seen.has(rec(r)!.id) && seen.add(rec(r)!.id) ? [rec(r)!] : []));
  };
  const rows = { lead: rowsOf("lead"), assigned: rowsOf("assigned"), unassigned: rowsOf("unassigned") };
  // One id-to-code table across the lists, so "carried from" resolves whichever list the original is in.
  const codeById = new Map([...rows.lead, ...rows.assigned, ...rows.unassigned].flatMap((r) => (typeof r.code === "string" ? [[Number(r.id), r.code] as [number, string]] : [])));
  const map = (rs: Rec[]) => rs.map((r) => itemFromApi(r, codeById));
  return { lead: map(rows.lead), assigned: map(rows.assigned), unassigned: map(rows.unassigned) };
}

/** One task with its activity and what the signed-in user may do with it (`canLeadEdit`, `readOnly`). Reused by the screens through src/stores/itemDetailStore.ts. */
export async function getItem(id: string): Promise<BacklogItemData> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error("That task isn't loaded yet. Reload the page and try again.");
  return fetchItem(apiId);
}

async function fetchItem(apiId: number): Promise<BacklogItemData> {
  const { data } = await apiClient.get<Rec>(`/items/${apiId}`);
  const item = itemFromApi(data);
  rememberItem(item);
  return item;
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

/** The request body for a new task: exactly what `createItem` sends. Throws when the owner has no owner record on the backend. */
export function newItemBody(input: NewItemInput): Rec {
  const body = bodyFrom(input);
  body.type = typeToApi(input.type);
  delete body.status; // a new task starts Open; the backend sets that
  delete body.completedAt;
  if (body.ownerId === undefined) body.ownerId = ownerIdByName(input.owner);
  return body;
}

/** Saves a new task. The backend gives it its code (BLG-n). */
export async function createItem(input: NewItemInput): Promise<BacklogItemData> {
  const { data } = await apiClient.post<Rec>("/items", newItemBody(input));
  const item = itemFromApi(data);
  rememberItem(item);
  return item;
}

/** Changes a task by its code. `hidden` goes to the visibility call; everything else to the task. */
export async function updateItem(id: string, patch: ItemPatch): Promise<BacklogItemData> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error("That task isn't loaded yet. Reload the page and try again.");
  const { hidden, ...rest } = patch;
  const body = bodyFrom(rest);
  if (Object.keys(body).length) await apiClient.patch(`/items/${apiId}`, body);
  if (hidden !== undefined) await apiClient.patch(`/items/${apiId}/visibility`, { hidden });
  return fetchItem(apiId);
}

/** What the task's Lead may change from My Task: status, assigned users, and the Lead Deadline. */
export async function updateItemAsLead(id: string, patch: Pick<ItemPatch, "status" | "assignees" | "leadDeadline">): Promise<BacklogItemData> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error("That task isn't loaded yet. Reload the page and try again.");
  const body: Rec = {};
  if (patch.status !== undefined) body.status = statusToApi(patch.status);
  if (patch.assignees !== undefined) body.assigneeIds = (bodyFrom({ assignees: patch.assignees }).assigneeIds as number[]) ?? [];
  if (patch.leadDeadline !== undefined) body.leadDeadline = patch.leadDeadline || null;
  await apiClient.patch(`/items/${apiId}/lead`, body);
  return fetchItem(apiId);
}

/** Request ids of this browser's own status changes, so the broadcast that follows one isn't applied a second time. */
const ownRequests = new Set<string>();
export const isOwnRequest = (requestId?: string) => !!requestId && ownRequests.has(requestId);
const newRequestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * BACKEND-DEPENDENT. An assigned user changing a task's status, with the work details they typed, saved in one step over Socket.IO
 * (events and payloads: src/types/socket.ts, names: src/constants/socketEvents.ts). Nothing is applied before the server says it has
 * validated and saved it; then the task is read again over REST so the screen shows the server's status and activity, not a guess.
 * Without NEXT_PUBLIC_SOCKET_URL (or while the server doesn't answer) it refuses with a clear message and changes nothing.
 */
export async function changeStatusWithDetails(id: string, status: Status, details: string): Promise<BacklogItemData> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error("That task isn't loaded yet. Reload the page and try again.");
  if (!socketEnabled) {
    throw new Error("Saving a status change with work details isn't available yet: it needs a server update that hasn't been released. Nothing was changed.");
  }
  const requestId = newRequestId();
  ownRequests.add(requestId);
  try {
    const ack = await emitWithAck<ChangeStatusRequest, ChangeStatusAck>(SOCKET_EVENTS.changeStatus, { requestId, itemId: apiId, status: statusToApi(status), details });
    if (!ack?.ok) throw new Error(ack?.message || "The server did not accept the change.");
  } catch (err) {
    ownRequests.delete(requestId); // it failed, so a later broadcast with this id can't be ours
    throw err;
  }
  return fetchItem(apiId);
}

export async function deleteItem(id: string): Promise<void> {
  const apiId = apiIdForCode(id);
  if (apiId == null) throw new Error("That task isn't loaded yet. Reload the page and try again.");
  await apiClient.delete(`/items/${apiId}`);
}
