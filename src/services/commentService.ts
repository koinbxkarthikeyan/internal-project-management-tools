import { apiClient } from "@/lib/apiClient";
import { apiIdForCode, list, rec } from "./mappers";

export type Mention = { id: string; name: string };
export type CommentImage = { id: number; name: string; type: string; size: number };
export type TaskComment = { id: string; userId: string; text: string; mentions: Mention[]; images: CommentImage[]; createdAt: string; /** Set when the author edited it. */ updatedAt?: string; by: string; team?: string; /** The Ticket a "created Ticket" note points to. */ ticket?: { id: number; code: string }; canEdit: boolean; canDelete: boolean; /** When the author can no longer edit or delete it (30 minutes after it was sent). */ editableUntil?: string };

function apiId(code: string): number {
  const id = apiIdForCode(code);
  if (id == null) throw new Error("That task isn't loaded yet. Reload the page and try again.");
  return id;
}

const commentFrom = (raw: unknown): TaskComment => {
  const c = rec(raw) ?? {};
  return { id: String(c.id), userId: String(rec(c.user)?.id ?? ""), text: String(c.text ?? ""), mentions: list(c.mentions).flatMap((m) => (rec(m) ? [{ id: String(rec(m)!.id), name: String(rec(m)!.name ?? "") }] : [])), images: list(c.images).flatMap((i) => (rec(i) ? [{ id: Number(rec(i)!.id), name: String(rec(i)!.name ?? "image"), type: String(rec(i)!.type ?? ""), size: Number(rec(i)!.size ?? 0) }] : [])), createdAt: String(c.createdAt ?? ""), ...(c.updatedAt ? { updatedAt: String(c.updatedAt) } : {}), by: String(rec(c.user)?.name ?? "Someone"), ...(c.team ? { team: String(c.team) } : {}), ...(rec(c.ticket) ? { ticket: { id: Number(rec(c.ticket)!.id), code: String(rec(c.ticket)!.code ?? "") } } : {}), canEdit: c.canEdit === true, canDelete: c.canDelete === true, ...(c.editableUntil ? { editableUntil: String(c.editableUntil) } : {}) };
};

/** The comments on one task, oldest first. */
export async function getComments(code: string): Promise<TaskComment[]> {
  const { data } = await apiClient.get<unknown>(`/items/${apiId(code)}/comments`);
  return list(rec(data)?.comments).map(commentFrom);
}

/** `mentionIds` are the people @mentioned (they are told); `withImages` lets the comment be only images, which are saved to it right after. */
export async function addComment(code: string, text: string, options: { mentionIds?: string[]; withImages?: boolean } = {}): Promise<TaskComment> {
  const { data } = await apiClient.post<unknown>(`/items/${apiId(code)}/comments`, { text, mentionIds: (options.mentionIds ?? []).map(Number), ...(options.withImages ? { withImages: true } : {}) });
  return commentFrom(data);
}

export async function editComment(id: string, text: string, mentionIds?: string[]): Promise<TaskComment> {
  const { data } = await apiClient.patch<unknown>(`/comments/${encodeURIComponent(id)}`, { text, ...(mentionIds ? { mentionIds: mentionIds.map(Number) } : {}) });
  return commentFrom(data);
}

export async function deleteComment(id: string): Promise<void> {
  await apiClient.delete(`/comments/${encodeURIComponent(id)}`);
}
