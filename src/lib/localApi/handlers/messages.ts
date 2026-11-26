import { CHAT_LIMITS, CODE_LANGUAGE_VALUES, REACTIONS, checkFile, type FileKind, type MessageKind } from "@/lib/chatConfig";
import { readBlob } from "@/lib/server/store";
import { deleteFile } from "../blobStore";
import { db, nextId, save, type DbChatFile, type DbItem, type DbMessage, type DbUser } from "../db";
import { codeOf, isAdminUser, nowISO, num, requireUser, type Req } from "../core";
import { fail } from "../errors";
import { create as addComment, edit as editComment, remove as removeComment, withinDeleteWindow } from "./comments";

const MAX_LENGTH = CHAT_LIMITS.textChars;
const KINDS: readonly string[] = ["text", "image", "video", "audio", "code", "file"];
const LABEL: Record<string, string> = { image: "Photo", video: "Video", audio: "Voice message", code: "Code snippet", file: "File" };

/** The people on a task, its POD: the Lead and the Assigned Users (people whose access is Enabled). */
const podOf = (item: DbItem): DbUser[] => {
  const ids = new Set([item.leadId, ...item.assigneeIds].filter((id): id is number => typeof id === "number"));
  return db().users.filter((u) => ids.has(u.id) && u.accessStatus === "ENABLED");
};

/** Who is on a task's chat (its POD): the people on it, and for a Ticket also the people on its task (a Ticket is part of its task, and its messages are read in the task's panel). The conversation list shows these. */
const inPod = (user: DbUser, item: DbItem): boolean => {
  if (podOf(item).some((u) => u.id === user.id)) return true;
  const parent = item.parentId == null ? undefined : db().items.find((i) => i.id === item.parentId);
  return !!parent && !parent.hidden && podOf(parent).some((u) => u.id === user.id);
};

/** Who may use a task's chat: anyone with access, as anyone who can open a task can write on it (the task's page shows the same conversation). */
const canUse = (user: DbUser): boolean => user.accessStatus === "ENABLED";

/** The conversation a request names, from the point of view of the person asking: the POD of a task ("task:<id>") or one other person ("dm:<id>"). */
type Conv = { key: string; item?: DbItem; other?: DbUser };
function conv(user: DbUser, raw: unknown): Conv {
  const key = String(raw ?? "");
  if (key.startsWith("task:")) {
    const item = db().items.find((i) => i.id === num(key.slice(5)));
    if (!item || item.hidden) fail(404, "That task doesn't exist.");
    if (!canUse(user)) fail(403, "Your access is disabled.");
    return { key, item };
  }
  const id = key.startsWith("dm:") ? num(key.slice(3)) : undefined;
  const other = id == null || id === user.id ? undefined : db().users.find((u) => u.id === id);
  if (!other) fail(404, "That person doesn't exist.");
  return { key, other };
}

// ---- typing ("Name is typing…") ----
// Who is typing where lives only in this server's memory (never in the data file, and it does not change the data revision, so nobody re-reads their messages because of it).
// A person counts as typing for a few seconds after their last report, so a closed page or a lost connection clears by itself.
const TYPING_MS = 5000;
type Room = Map<number, { name: string; at: number }>;
const rooms = (): Map<string, Room> => ((globalThis as { __koinbxTyping?: Map<string, Room> }).__koinbxTyping ??= new Map());
/** The same room for both sides: a direct chat is "dm:<lower id>:<higher id>", a POD's chat is its task's key. */
const roomOf = (user: DbUser, c: Conv) => (c.other ? `dm:${Math.min(user.id, c.other.id)}:${Math.max(user.id, c.other.id)}` : c.key);

/** The person starts or stops typing in a conversation they belong to (the conversation is checked like any other request). */
export function typing({ data }: Req) {
  const user = requireUser();
  const room = roomOf(user, conv(user, data.conv));
  const all = rooms();
  const who = all.get(room) ?? new Map();
  if (data.typing === true) who.set(user.id, { name: user.name, at: Date.now() });
  else who.delete(user.id);
  if (who.size) all.set(room, who);
  else all.delete(room);
  return { ok: true };
}

/** Who else is typing in each of up to six conversations: `{ "<conversation>": ["Name", …] }` (the person asking is never in it). */
export function typingNow({ query }: Req) {
  const user = requireUser();
  const now = Date.now();
  const out: Record<string, string[]> = {};
  for (const key of String(query.convs ?? "").split(",").filter(Boolean).slice(0, 6)) {
    let room: string;
    try {
      room = roomOf(user, conv(user, key));
    } catch {
      continue; // not a conversation this person may use
    }
    const who = rooms().get(room);
    if (!who) continue;
    for (const [id, t] of who) if (now - t.at > TYPING_MS) who.delete(id);
    const names = [...who].filter(([id]) => id !== user.id).map(([, t]) => t.name);
    if (names.length) out[key] = names;
  }
  return { typing: out };
}

type Msg = Omit<DbMessage, "toId"> & { /** Set on a message of a Ticket read through its task: the Ticket it belongs to. */ taskId?: number; /** Where it is kept: a direct message, or a comment on a task. */ refType: "dm" | "comment" };

/** The messages of one conversation, oldest first, without the ones this person deleted for themselves. A POD's chat is the task's comments (the Comments tab of the task shows the same ones); a comment with no words is its images. */
const messagesOf = (user: DbUser, c: Conv): Msg[] => {
  const hidden = new Set(db().chatHidden[String(user.id)]?.[c.key] ?? []);
  const all: Msg[] = c.item
    ? db().comments.filter((m) => m.itemId === c.item!.id).sort((a, b) => a.id - b.id).map((m) => ({ id: m.id, fromId: m.userId, text: m.deleted ? "" : m.text || ((m.kind && m.kind !== "text") || db().attachments.some((a) => a.commentId === m.id) ? "" : "Image"), createdAt: m.createdAt, refType: "comment" as const, ...(m.kind ? { kind: m.kind } : {}), ...(m.lang ? { lang: m.lang } : {}), ...(m.replyTo ? { replyTo: m.replyTo } : {}), ...(m.reactions ? { reactions: m.reactions } : {}), ...(m.updatedAt ? { editedAt: m.updatedAt } : {}), ...(m.deleted ? { deleted: true } : {}) }))
    : db().messages.filter((m) => (m.fromId === user.id && m.toId === c.other!.id) || (m.fromId === c.other!.id && m.toId === user.id)).map((m) => ({ ...m, refType: "dm" as const }));
  return all.filter((m) => !hidden.has(m.id));
};

/** The message another one replies to, as a short quote (resolved in the same place the message is kept). */
const quoteOf = (m: Msg) => {
  if (!m.replyTo) return undefined;
  const q = m.refType === "dm" ? db().messages.find((x) => x.id === m.replyTo) : db().comments.find((x) => x.id === m.replyTo);
  if (!q) return undefined;
  const fromId = "fromId" in q ? q.fromId : q.userId;
  return { id: q.id, fromId, text: q.deleted ? "" : q.text.slice(0, 120) || (q.kind && q.kind !== "text" ? LABEL[q.kind] : ""), deleted: !!q.deleted };
};
const filesOf = (m: Msg) => [
  ...db().chatFiles.filter((f) => f.ref?.type === m.refType && f.ref.id === m.id).map((f) => ({ id: f.id, name: f.name, type: f.type, size: f.size, kind: f.kind, ...(f.duration ? { duration: f.duration } : {}) })),
  // Pictures attached to a comment before chat files existed are still shown (they are read from their own store).
  ...(m.refType === "comment" ? db().attachments.filter((a) => a.commentId === m.id).map((a) => ({ id: a.id, name: a.name, type: a.type, size: a.size, kind: "image" as const, url: `/api/blob/${a.id}` })) : []),
];
/** The Ticket a "created Ticket …" note points to. */
const ticketOfNote = (m: Msg) => {
  const c = m.refType === "comment" ? db().comments.find((x) => x.id === m.id) : undefined;
  const t = c?.ticketId == null ? undefined : db().items.find((i) => i.id === c.ticketId);
  return t ? { id: t.id, code: codeOf(t) } : undefined;
};
const out = (m: Msg) => ({
  id: m.id,
  fromId: m.fromId,
  text: m.deleted ? "" : m.text,
  createdAt: m.createdAt,
  ...(m.deleted ? { deleted: true } : {}),
  ...(m.taskId != null ? { taskId: m.taskId } : {}),
  ...(!m.deleted && m.kind && m.kind !== "text" ? { kind: m.kind } : {}),
  ...(!m.deleted && m.lang ? { lang: m.lang } : {}),
  ...(!m.deleted && m.editedAt ? { edited: true } : {}),
  ...(!m.deleted && m.reactions && Object.keys(m.reactions).length ? { reactions: m.reactions } : {}),
  ...(!m.deleted && m.replyTo && quoteOf(m) ? { replyTo: quoteOf(m) } : {}),
  ...(!m.deleted && filesOf(m).length ? { files: filesOf(m) } : {}),
  ...(!m.deleted && ticketOfNote(m) ? { ticket: ticketOfNote(m) } : {}),
});

/** The Tickets of a task whose chat the person is in (a Ticket they are not on is not theirs to read). */
const ticketConvs = (user: DbUser, item: DbItem): Conv[] =>
  db().items.filter((i) => i.parentId === item.id && !i.hidden && inPod(user, i)).map((i) => ({ key: `task:${i.id}`, item: i }));
const readUpTo = (userId: number, key: string) => db().chatReads[String(userId)]?.[key] ?? 0;

/** Where each conversation stands for the person asking: the newest message and how many they haven't read (their own messages never count). */
export function conversations() {
  const user = requireUser();
  const summary = (c: Conv) => {
    const msgs = messagesOf(user, c);
    const last = msgs.at(-1);
    const seen = readUpTo(user.id, c.key);
    return { key: c.key, ...(last ? { last: out(last) } : {}), unread: msgs.filter((m) => m.id > seen && m.fromId !== user.id && !m.deleted).length, hasMessages: msgs.length > 0 };
  };
  // A POD is every task the person is on (as Lead or Assigned User), even when they are the only one so far; a finished task stays only while it has messages.
  const pods = db()
    .items.filter((i) => !i.hidden)
    .flatMap((item) => {
      const members = podOf(item);
      if (!inPod(user, item)) return [];
      const s = summary({ key: `task:${item.id}`, item });
      if (item.status === "COMPLETED" && !s.hasMessages) return [];
      return [{ taskId: item.id, parentId: item.parentId ?? null, code: codeOf(item), title: item.title, status: item.status, done: item.status === "COMPLETED", members: members.map((u) => ({ id: u.id, name: u.name })), ...s }];
    });
  const dms = db()
    .users.filter((u) => u.id !== user.id && u.accessStatus === "ENABLED")
    .map((u) => ({ userId: u.id, ...summary({ key: `dm:${u.id}`, other: u }) }));
  return { pods, dms };
}

export function list({ query }: Req) {
  const user = requireUser();
  const c = conv(user, query.conv);
  const after = num(query.after) ?? 0;
  let all = messagesOf(user, c);
  // `tickets`: a task's chat with the messages of its Tickets in it, each tagged with its Ticket, in the order they were written.
  if (c.item && (query.tickets === true || query.tickets === "true")) {
    const fromTickets = ticketConvs(user, c.item).flatMap((t) => messagesOf(user, t).map((m) => ({ ...m, taskId: t.item!.id })));
    all = [...all, ...fromTickets].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  }
  // Each message the person sent says whether it has been read: by the other person (a direct message) or by everyone else on the task (a POD), the way ticks do in a chat app.
  const readBy = (m: Msg) => {
    if (m.fromId !== user.id) return undefined;
    const seen = (id: number, key: string) => readUpTo(id, key) >= m.id;
    if (c.other) return seen(c.other.id, `dm:${user.id}`);
    const item = db().items.find((i) => i.id === (m.taskId ?? c.item!.id));
    const others = item ? podOf(item).filter((u) => u.id !== user.id) : [];
    return others.length > 0 && others.every((u) => seen(u.id, `task:${item!.id}`));
  };
  return { messages: all.filter((m) => m.id > after).slice(-200).map((m) => ({ ...out(m), ...(readBy(m) !== undefined ? { read: readBy(m) } : {}), ...(!m.deleted && (c.item ? isAdminUser(user) || (m.fromId === user.id && withinDeleteWindow(m.createdAt)) : m.fromId === user.id && withinDeleteWindow(m.createdAt)) ? { canDelete: true } : {}) })) };
}

/** Whether this person may read a chat file: the uploader while it is not sent yet; afterwards the two people of a direct chat, or the people on the task of a group chat. */
export function canReadFile(user: DbUser, f: DbChatFile): boolean {
  if (!f.ref) return f.userId === user.id;
  if (f.members) return f.members.includes(user.id);
  const item = f.itemId == null ? undefined : db().items.find((i) => i.id === f.itemId);
  return !!item && !item.hidden && canUse(user);
}

/**
 * Step one of sending files: the details of the files about to be uploaded (name, type, size, and for a voice message or video its length) are checked against the limits in
 * chatConfig and registered; the answer gives each file's id, under which its bytes are then uploaded (PUT /api/chat-file/<id>). Nothing is sent to the other people yet.
 */
export function registerFiles({ data }: Req) {
  const user = requireUser();
  if (user.accessStatus !== "ENABLED") fail(403, "Your access is disabled.");
  const c = conv(user, data.conv);
  const kind = String(data.kind ?? "") as FileKind;
  if (!["image", "video", "audio", "file"].includes(kind)) fail(400, "Choose what kind of file this is.");
  const files = Array.isArray(data.files) ? (data.files as Record<string, unknown>[]) : [];
  if (files.length === 0) fail(400, "Choose at least one file.");
  if (files.length > CHAT_LIMITS.filesPerMessage) fail(400, `A message can have at most ${CHAT_LIMITS.filesPerMessage} files.`);
  // Files registered long ago and never sent (an upload given up) are cleaned away.
  const stale = db().chatFiles.filter((f) => !f.ref && Date.now() - Date.parse(f.createdAt) > 24 * 3600_000);
  if (stale.length) {
    db().chatFiles = db().chatFiles.filter((f) => !stale.includes(f));
    for (const f of stale) void deleteFile(f.id).catch(() => undefined);
  }
  const made: DbChatFile[] = files.map((f) => {
    const name = String(f.name ?? "").replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 120) || "file";
    const entry = { name, type: String(f.type ?? ""), size: Number(f.size) };
    const problem = checkFile(entry, kind);
    if (problem) fail(400, problem);
    const duration = Number(f.duration);
    if (kind === "audio" && Number.isFinite(duration) && duration > CHAT_LIMITS.voiceSeconds + 5) fail(400, `A voice message can be at most ${Math.round(CHAT_LIMITS.voiceSeconds / 60)} minutes.`);
    return { id: nextId("attachment"), userId: user.id, name, type: entry.type, size: entry.size, kind, ...(Number.isFinite(duration) && duration > 0 ? { duration: Math.round(duration) } : {}), createdAt: nowISO(), ...(c.other ? { members: [user.id, c.other.id] } : { itemId: c.item!.id }) };
  });
  db().chatFiles.push(...made);
  save();
  return { files: made.map((f) => ({ id: f.id, name: f.name })) };
}

/** Removes the files of a message (the details and the stored bytes). */
export function dropFiles(type: "dm" | "comment", id: number) {
  const gone = db().chatFiles.filter((f) => f.ref?.type === type && f.ref.id === id);
  db().chatFiles = db().chatFiles.filter((f) => !gone.includes(f));
  for (const f of gone) void deleteFile(f.id).catch(() => undefined);
}

export function send({ data }: Req) {
  const user = requireUser();
  if (user.accessStatus !== "ENABLED") fail(403, "Your access is disabled.");
  const c = conv(user, data.conv);
  const kind = (KINDS.includes(String(data.kind)) ? String(data.kind) : "text") as MessageKind;
  // Code keeps its indentation (only blank lines at the ends go); every other text is trimmed.
  const raw = String(data.text ?? "").replace(/\r\n/g, "\n");
  const text = kind === "code" ? raw.replace(/^\n+|\s+$/g, "") : raw.trim();
  const lang = kind === "code" ? String(data.lang ?? "") : undefined;
  if (kind === "code") {
    if (!text) fail(400, "Write the code first.");
    if (!CODE_LANGUAGE_VALUES.includes(lang!)) fail(400, "Choose the language of the code.");
    if (text.length > CHAT_LIMITS.codeChars) fail(400, `A code snippet can be at most ${CHAT_LIMITS.codeChars} characters.`);
  } else if (text.length > MAX_LENGTH) fail(400, `A message can be at most ${MAX_LENGTH} characters.`);
  // Files: registered by this person, uploaded, not sent yet, and of the kind the message says.
  const fileIds = Array.isArray(data.fileIds) ? (data.fileIds as unknown[]).map(Number) : [];
  const files = fileIds.map((id) => db().chatFiles.find((f) => f.id === id && f.userId === user.id && !f.ref));
  if (kind === "text" || kind === "code") {
    if (fileIds.length) fail(400, "A text message has no files.");
    if (kind === "text" && !text) fail(400, "Write a message first.");
  } else {
    if (files.length === 0) fail(400, "Choose at least one file.");
    if (files.length > CHAT_LIMITS.filesPerMessage) fail(400, `A message can have at most ${CHAT_LIMITS.filesPerMessage} files.`);
    for (const f of files) {
      if (!f) fail(400, "One of the files isn't ready. Upload it again.");
      if (f!.kind !== kind) fail(400, `${f!.name} doesn't belong in a ${kind} message.`);
      if (!readBlob(f!.id)) fail(400, `${f!.name} hasn't finished uploading.`);
    }
  }
  if (c.other && c.other.accessStatus !== "ENABLED") fail(400, `${c.other.name} can't receive messages (access is disabled).`);
  const replyTo = data.replyTo != null ? Number(data.replyTo) : undefined;
  if (replyTo != null && !messagesOf(user, c).some((m) => m.id === replyTo)) fail(400, "The message you are replying to isn't in this chat.");
  const shown = kind === "text" ? text : text || (LABEL[kind] ?? "");
  const extra = { ...(kind !== "text" ? { kind } : {}), ...(lang ? { lang } : {}), ...(replyTo != null ? { replyTo } : {}) };
  const link = (type: "dm" | "comment", id: number) => {
    for (const f of files) if (f) f.ref = { type, id };
  };
  // A message to a POD is a comment on the task (people following it are told as for any comment).
  if (c.item) {
    const comment = addComment({ params: { id: c.item.id }, data: { text: kind === "text" ? text : shown.slice(0, 200), withImages: kind !== "text" && kind !== "code" && !text, mentionIds: Array.isArray(data.mentionIds) ? data.mentionIds : [] }, query: {} }) as { id: number };
    const stored = db().comments.find((x) => x.id === comment.id)!;
    stored.text = kind === "code" ? text : kind === "text" ? stored.text : text;
    Object.assign(stored, extra);
    link("comment", comment.id);
    (db().chatReads[String(user.id)] ??= {})[c.key] = comment.id;
    save();
    return out(messagesOf(user, c).at(-1)!);
  }
  const m: DbMessage = { id: nextId("message"), fromId: user.id, text, createdAt: nowISO(), toId: c.other!.id, ...extra };
  db().messages.push(m);
  link("dm", m.id);
  // The other person is told through the bell (it rings and chimes there), with the message as its text.
  const nid = nextId("notification");
  db().notifications.push({ id: nid, eventId: `n-${nid}`, recipientId: c.other!.id, type: "chat.message", taskId: 0, taskCode: "", taskTitle: "", actor: { id: user.id, name: user.name }, occurredAt: nowISO(), message: (kind === "code" ? `Shared a ${lang} code snippet` : shown).slice(0, 480) });
  // What the sender sends, they have read.
  (db().chatReads[String(user.id)] ??= {})[c.key] = m.id;
  save();
  return out({ ...m, refType: "dm" });
}

/** The target of an action on one message: the direct message or the comment, if the person can read this conversation. */
function target(user: DbUser, c: Conv, id: number | undefined) {
  const comment = c.item ? db().comments.find((x) => x.id === id && (x.itemId === c.item!.id || ticketConvs(user, c.item!).some((t) => t.item!.id === x.itemId))) : undefined;
  const dm = c.other ? db().messages.find((x) => x.id === id && ((x.fromId === user.id && x.toId === c.other!.id) || (x.fromId === c.other!.id && x.toId === user.id))) : undefined;
  if (!comment && !dm) fail(404, "That message doesn't exist.");
  return { comment, dm };
}

/** Changes the words of the person's own text message (within 30 minutes, as for any comment). */
export function edit({ data }: Req) {
  const user = requireUser();
  const c = conv(user, data.conv);
  const { comment, dm } = target(user, c, num(data.id));
  const text = String(data.text ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) fail(400, "Write a message first.");
  if (text.length > MAX_LENGTH) fail(400, `A message can be at most ${MAX_LENGTH} characters.`);
  if (comment) {
    if (comment.kind && comment.kind !== "text") fail(400, "Only a text message can be edited.");
    editComment({ params: { id: comment.id }, data: { text }, query: {} });
    return out(messagesOf(user, c).find((m) => m.id === comment.id)!);
  }
  const m = dm!;
  if (m.fromId !== user.id) fail(403, "You can only edit your own messages.");
  if (m.deleted) fail(400, "That message was deleted.");
  if (m.kind && m.kind !== "text") fail(400, "Only a text message can be edited.");
  if (Date.now() - Date.parse(m.createdAt) > 30 * 60_000) fail(403, "A message can only be edited within 30 minutes of sending it.");
  m.text = text;
  m.editedAt = nowISO();
  save();
  return out({ ...m, refType: "dm" });
}

/** Adds the person's reaction (one of the quick emoji) to a message, or takes it back when they had already given it. */
export function react({ data }: Req) {
  const user = requireUser();
  const c = conv(user, data.conv);
  const emoji = String(data.emoji ?? "");
  if (!(REACTIONS as readonly string[]).includes(emoji)) fail(400, "That reaction isn't available.");
  const { comment, dm } = target(user, c, num(data.id));
  const holder = (comment ?? dm)!;
  if (holder.deleted) fail(400, "That message was deleted.");
  const all = (holder.reactions ??= {});
  const who = new Set(all[emoji] ?? []);
  if (who.has(user.id)) who.delete(user.id);
  else who.add(user.id);
  if (who.size) all[emoji] = [...who];
  else delete all[emoji];
  if (!Object.keys(all).length) delete holder.reactions;
  save();
  return { reactions: holder.reactions ?? {} };
}

export function markRead({ data }: Req) {
  const user = requireUser();
  const c = conv(user, data.conv);
  // `tickets`: the task and all its Tickets are read together (they are shown in one panel).
  let changed = false;
  for (const x of [c, ...(c.item && data.tickets === true ? ticketConvs(user, c.item) : [])]) {
    const newest = messagesOf(user, x).at(-1)?.id ?? 0;
    if (newest > readUpTo(user.id, x.key)) {
      (db().chatReads[String(user.id)] ??= {})[x.key] = newest;
      changed = true;
    }
  }
  // Reading a direct chat also reads its notices in the bell.
  if (c.other) {
    for (const n of db().notifications) {
      if (n.recipientId === user.id && n.type === "chat.message" && n.actor.id === c.other.id && !n.readAt) {
        n.readAt = nowISO();
        changed = true;
      }
    }
  }
  if (changed) save();
  return { ok: true };
}

/**
 * Deleting a message, as in a chat app. `scope` "everyone": in a direct chat only the person's own message (within 30 hours of sending it) — nobody else, whatever their role, and no deleting the other person's messages for oneself either; in a group (task) chat the author's own, and also any message for a Super Admin or an enabled Admin. It stays in the chat as "This message was deleted" for everybody
 * (its words are gone). `scope` "me": any message in a conversation the person can read is hidden from them only, at any time.
 */
export function remove({ data }: Req) {
  const user = requireUser();
  const c = conv(user, data.conv);
  const id = num(data.id);
  const comment = c.item ? db().comments.find((x) => x.id === id && (x.itemId === c.item!.id || ticketConvs(user, c.item!).some((t) => t.item!.id === x.itemId))) : undefined;
  const dm = c.other ? db().messages.find((x) => x.id === id && ((x.fromId === user.id && x.toId === c.other!.id) || (x.fromId === c.other!.id && x.toId === user.id))) : undefined;
  if (!comment && !dm) fail(404, "That message doesn't exist.");
  // In a direct chat nobody deletes the other person's messages, in any way (a Super Admin or an Admin included): each person manages only their own.
  if (dm && dm.fromId !== user.id) fail(403, "You can delete only your own messages in a direct chat.");
  // A normal user deletes only their own messages (for everyone or for themselves); in a group chat only a Super Admin or an enabled Admin can also remove other people's.
  if (comment && comment.userId !== user.id && !isAdminUser(user)) fail(403, "You can delete only your own messages.");
  if (data.scope === "me") {
    // The conversation key the message is read through: a Ticket's message is in the Ticket's own conversation.
    const key = comment && c.item && comment.itemId !== c.item.id ? `task:${comment.itemId}` : c.key;
    const mine = (db().chatHidden[String(user.id)] ??= {});
    mine[key] = [...new Set([...(mine[key] ?? []), id as number])];
    save();
    return null;
  }
  if (comment) {
    // A message in a group (a task's chat) is a comment on the task: its author deletes their own (30 hours), and a Super Admin or an enabled Admin may remove any of them, as on the Comments tab.
    if (comment.userId !== user.id && !isAdminUser(user)) fail(403, "You can delete only your own messages for everyone.");
    return removeComment({ params: { id }, data: {}, query: {} });
  }
  if (dm!.fromId !== user.id) fail(403, "You can delete only your own messages for everyone.");
  if (!withinDeleteWindow(dm!.createdAt)) fail(403, "A message can only be deleted for everyone within 30 hours of sending it.");
  dm!.deleted = true;
  dm!.text = "";
  dropFiles("dm", dm!.id);
  save();
  return null;
}
