import { db, nextId, save } from "../db";
import { clean, findItem, isSprintClosed, logActivity, nowISO, requireUser, userRef, type Req } from "../core";
import { deleteFile } from "../blobStore";
import { fail } from "../errors";
import { canManageTicket, rootOf } from "./items";

/** What a Ticket's images may be: real image formats only (no SVG, which can carry script), 10 per Ticket. The original file may be any size; this limit is on the optimized image that is stored. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 10;

const out = (a: { id: number; itemId: number; taskId: number; name: string; type: string; size: number; originalSize?: number; createdAt: string; userId: number }) => ({
  id: a.id,
  itemId: a.itemId,
  taskId: a.taskId,
  name: a.name,
  type: a.type,
  size: a.size,
  originalSize: a.originalSize ?? a.size,
  createdAt: a.createdAt,
  ...(userRef(a.userId) ? { by: userRef(a.userId)!.name } : {}),
});

function ticketOf(id: unknown) {
  const ticket = findItem(id);
  if (ticket.type !== "TICKET") fail(400, "Images can only be attached to a Ticket.");
  return ticket;
}

export function list({ params }: Req) {
  requireUser();
  const ticket = ticketOf(params.id);
  return { attachments: db().attachments.filter((a) => a.itemId === ticket.id && a.commentId == null).sort((a, b) => a.id - b.id).map(out) };
}

/**
 * Registers the details of images being attached (the files themselves are stored by the caller under the ids this returns). They go to a Ticket's own
 * attachments, or, with a `commentId`, into that comment of any task or Ticket (only its author may add them).
 */
export function add({ params, data }: Req) {
  const me = requireUser();
  const d = db();
  const commentId = data.commentId != null ? Number(data.commentId) : null;
  const comment = commentId != null ? d.comments.find((c) => c.id === commentId) : undefined;
  if (commentId != null && (!comment || comment.itemId !== Number(params.id))) fail(404, "That comment doesn't exist.");
  const item = commentId != null ? findItem(params.id) : ticketOf(params.id);
  if (comment) {
    if (comment.userId !== me.id) fail(403, "Only the author of a comment can add images to it.");
  } else if (!canManageTicket(item, me)) fail(403, "Only the Ticket's assignee or creator, QA or an admin can attach images.");
  if (isSprintClosed(item.sprintId)) fail(403, "That sprint is closed, so its Tickets can only be viewed.");
  const files = Array.isArray(data.files) ? (data.files as Record<string, unknown>[]) : [];
  if (files.length === 0) fail(400, "Choose at least one image.");
  const perComment = 5;
  const already = d.attachments.filter((a) => (comment ? a.commentId === comment.id : a.itemId === item.id && a.commentId == null)).length;
  const limit = comment ? perComment : MAX_IMAGES;
  if (already + files.length > limit) fail(400, comment ? `A comment can have at most ${perComment} images.` : `A Ticket can have at most ${MAX_IMAGES} images.`);
  const made = files.map((f) => {
    const name = clean(f.name).slice(0, 120) || "image";
    const type = String(f.type ?? "");
    const size = Number(f.size);
    if (!IMAGE_TYPES.includes(type)) fail(400, `${name} isn't a supported image. Use JPG, PNG or WebP.`);
    if (!Number.isFinite(size) || size <= 0) fail(400, `${name} is empty.`);
    if (size > MAX_IMAGE_BYTES) fail(400, `${name} is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB even after optimizing.`);
    const originalSize = Number.isFinite(Number(f.originalSize)) && Number(f.originalSize) > 0 ? Number(f.originalSize) : size;
    return { id: nextId("attachment"), itemId: item.id, taskId: rootOf(item).id, name, type, size, originalSize, createdAt: nowISO(), userId: me.id, ...(comment ? { commentId: comment.id } : {}) };
  });
  d.attachments.push(...made);
  if (!comment) logActivity(item, made.length === 1 ? `Attached image ${made[0].name}` : `Attached ${made.length} images`, me.id);
  save();
  return { attachments: made.map(out) };
}

export async function remove({ params }: Req) {
  const me = requireUser();
  const d = db();
  const attachment = d.attachments.find((a) => a.id === Number(params.id));
  if (!attachment) fail(404, "That image doesn't exist.");
  const a = attachment as NonNullable<typeof attachment>;
  const ticket = findItem(a.itemId);
  if (!canManageTicket(ticket, me)) fail(403, "Only the Ticket's assignee or creator, QA or an admin can remove images.");
  if (isSprintClosed(ticket.sprintId)) fail(403, "That sprint is closed, so its Tickets can only be viewed.");
  d.attachments = d.attachments.filter((x) => x.id !== a.id);
  logActivity(ticket, `Removed image ${a.name}`, me.id);
  save();
  await deleteFile(a.id).catch(() => undefined);
  return null;
}
