import { db, nextId, save, type DbComment, type DbUser } from "../db";
import { codeOf, findItem, isAdminUser, nowISO, requireUser, userRef, type Req } from "../core";
import { deleteFile } from "../blobStore";
import { fail } from "../errors";
import { followers, notify } from "./notifications";

const MAX = 2000;
/** A message can be edited or deleted by its author for this long after it was sent. */
const WINDOW_MS = 30 * 60_000;
const inWindow = (c: DbComment) => Date.now() - Date.parse(c.createdAt) <= WINDOW_MS;
const LATE = "A message can only be edited or deleted within 30 minutes of sending it.";

/** The people @mentioned, as sent: real, distinct users only. */
const mentionsOf = (raw: unknown): number[] => [...new Set((Array.isArray(raw) ? raw : []).map(Number))].filter((id) => db().users.some((u) => u.id === id)).slice(0, 20);

/** The author's team is the one they had when they wrote it; comments from before that was kept show their current team. */
const out = (c: DbComment, me: DbUser) => ({
  id: c.id,
  text: c.text,
  createdAt: c.createdAt,
  ...(c.updatedAt ? { updatedAt: c.updatedAt } : {}),
  ...(userRef(c.userId) ? { user: userRef(c.userId) } : {}),
  mentions: (c.mentionIds ?? []).flatMap((id) => userRef(id) ?? []),
  images: db().attachments.filter((a) => a.commentId === c.id).sort((a, b) => a.id - b.id).map((a) => ({ id: a.id, name: a.name, type: a.type, size: a.size })),
  ...(c.ticketId && db().items.some((i) => i.id === c.ticketId) ? { ticket: { id: c.ticketId, code: codeOf(db().items.find((i) => i.id === c.ticketId)!) } } : {}),
  team: c.team !== undefined ? c.team : (db().users.find((u) => u.id === c.userId)?.team ?? null),
  canEdit: c.userId === me.id && inWindow(c),
  canDelete: (c.userId === me.id && inWindow(c)) || isAdminUser(me),
  editableUntil: new Date(Date.parse(c.createdAt) + WINDOW_MS).toISOString(),
});

export function list({ params }: Req) {
  const me = requireUser();
  const item = findItem(params.id);
  const rows = db().comments.filter((c) => c.itemId === item.id).sort((a, b) => a.id - b.id);
  return { comments: rows.map((c) => out(c, me)) };
}

export function create({ params, data }: Req) {
  const me = requireUser();
  const item = findItem(params.id);
  const text = String(data.text ?? "").trim();
  // A comment may be only images (they are saved right after it).
  if (!text && data.withImages !== true) fail(400, "Write a comment first.");
  if (text.length > MAX) fail(400, `A comment can be at most ${MAX} characters.`);
  const mentionIds = mentionsOf(data.mentionIds);
  const comment: DbComment = { id: nextId("comment"), itemId: item.id, userId: me.id, text, createdAt: nowISO(), team: me.team ?? null, ...(mentionIds.length ? { mentionIds } : {}) };
  db().comments.push(comment);
  // The people mentioned are told they were; the others who follow the task get the ordinary comment notice.
  notify(item, "task.commented", me, followers(item).filter((id) => !mentionIds.includes(id as number)), undefined, text.slice(0, 480), { commentId: comment.id });
  notify(item, "task.commented", me, mentionIds, undefined, `mentioned you: ${text.slice(0, 460)}`, { commentId: comment.id });
  save();
  return out(comment, me);
}

/** The author changes the words of their own comment (nobody else's, not even an admin's); it is marked as edited. */
export function edit({ params, data }: Req) {
  const me = requireUser();
  const comment = db().comments.find((c) => c.id === Number(params.id));
  if (!comment) fail(404, "That comment doesn't exist.");
  const c = comment as DbComment;
  if (c.userId !== me.id) fail(403, "You can only edit your own comments.");
  if (!inWindow(c)) fail(403, LATE);
  const text = String(data.text ?? "").trim();
  if (!text) fail(400, "Write a comment first.");
  if (text.length > MAX) fail(400, `A comment can be at most ${MAX} characters.`);
  const mentionIds = data.mentionIds === undefined ? (c.mentionIds ?? []) : mentionsOf(data.mentionIds);
  const added = mentionIds.filter((id) => !(c.mentionIds ?? []).includes(id));
  if (text !== c.text || added.length || mentionIds.length !== (c.mentionIds ?? []).length) {
    c.text = text;
    if (mentionIds.length) c.mentionIds = mentionIds;
    else delete c.mentionIds;
    c.updatedAt = nowISO();
    const item = db().items.find((i) => i.id === c.itemId);
    if (item && added.length) notify(item, "task.commented", me, added, undefined, `mentioned you: ${text.slice(0, 460)}`, { commentId: c.id });
    save();
  }
  return out(c, me);
}

export function remove({ params }: Req) {
  const me = requireUser();
  const comment = db().comments.find((c) => c.id === Number(params.id));
  if (!comment) fail(404, "That comment doesn't exist.");
  if (comment && comment.userId !== me.id && !isAdminUser(me)) fail(403, "You can only delete your own comments.");
  // The author deletes within the 30 minutes; an admin may remove a message at any time.
  if (comment && comment.userId === me.id && !isAdminUser(me) && !inWindow(comment)) fail(403, LATE);
  db().comments = db().comments.filter((c) => c.id !== Number(params.id));
  // Its images go with it (the details here, the files in the image store).
  for (const a of db().attachments.filter((x) => x.commentId === Number(params.id))) void deleteFile(a.id).catch(() => undefined);
  db().attachments = db().attachments.filter((x) => x.commentId !== Number(params.id));
  save();
  return null;
}
