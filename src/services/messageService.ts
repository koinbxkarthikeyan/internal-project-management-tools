import { apiClient } from "@/lib/apiClient";
import type { FileKind, MessageKind } from "@/lib/chatConfig";
import type { Status } from "@/types/backlog";
import { list, rec, statusFromApi } from "./mappers";

/** A file sent with a message. */
export type ChatFile = { /** Where the file is read, when it is not the chat file store (a picture attached before chat files existed). */ url?: string; id: number; name: string; type: string; size: number; kind: FileKind; /** Seconds, for a voice message or a video. */ duration?: number };
/** The message another one replies to, as a short quote. */
export type ChatQuote = { id: number; fromId: string; text: string; deleted: boolean };
export type ChatMessage = { /** The Ticket a "created Ticket …" note points to. */ ticket?: { id: number; code: string }; /** What kind of message it is (text when absent). */ kind?: MessageKind; /** The language of a code message. */ lang?: string; files?: ChatFile[]; /** Reactions: emoji → the ids of the people who gave it. */ reactions?: Record<string, string[]>; replyTo?: ChatQuote; /** The author changed the words. */ edited?: boolean; id: number; fromId: string; text: string; createdAt: string; /** Deleted for everyone: shown as "This message was deleted". */ deleted?: boolean; /** The person's own message can still be deleted (within 30 hours of sending). */ canDelete?: boolean; /** On a message the person sent: whether the other people have read it (one tick when sent, two when read). */ read?: boolean; /** On a task's chat that includes its Tickets: the Ticket a message belongs to. */ taskId?: number };
export type ChatSummary = { key: string; last?: ChatMessage; unread: number };
/** A POD: the people on a task (its Lead and Assigned Users), with their group chat. */
export type ChatPod = ChatSummary & { taskId: number; /** The task a Ticket belongs to. */ parentId: number | null; code: string; title: string; /** The task's status. */ status: Status; done: boolean; members: { id: string; name: string }[] };
/** Where the conversations stand: the PODs the person is in and each other person, by id. */
export type ChatOverview = { pods: ChatPod[]; dms: Record<string, ChatSummary> };

const messageFrom = (raw: unknown): ChatMessage => {
  const m = rec(raw) ?? {};
  const q = rec(m.replyTo);
  const reactions = rec(m.reactions);
  return {
    id: Number(m.id),
    fromId: String(m.fromId),
    text: String(m.text ?? ""),
    createdAt: String(m.createdAt ?? ""),
    ...(m.canDelete === true ? { canDelete: true } : {}),
    ...(m.deleted === true ? { deleted: true } : {}),
    ...(typeof m.read === "boolean" ? { read: m.read } : {}),
    ...(m.taskId != null ? { taskId: Number(m.taskId) } : {}),
    ...(typeof m.kind === "string" ? { kind: m.kind as MessageKind } : {}),
    ...(typeof m.lang === "string" ? { lang: m.lang } : {}),
    ...(rec(m.ticket) ? { ticket: { id: Number(rec(m.ticket)!.id), code: String(rec(m.ticket)!.code ?? "") } } : {}),
    ...(m.edited === true ? { edited: true } : {}),
    ...(reactions ? { reactions: Object.fromEntries(Object.entries(reactions).map(([e, ids]) => [e, list(ids).map(String)])) } : {}),
    ...(q ? { replyTo: { id: Number(q.id), fromId: String(q.fromId), text: String(q.text ?? ""), deleted: q.deleted === true } } : {}),
    ...(list(m.files).length
      ? { files: list(m.files).map((f) => { const x = rec(f) ?? {}; return { id: Number(x.id), name: String(x.name ?? "file"), type: String(x.type ?? ""), size: Number(x.size ?? 0), kind: String(x.kind) as FileKind, ...(x.url ? { url: String(x.url) } : {}), ...(x.duration ? { duration: Number(x.duration) } : {}) }; }) }
      : {}),
  };
};
const summaryFrom = (raw: unknown): ChatSummary => {
  const s = rec(raw) ?? {};
  return { key: String(s.key), ...(s.last ? { last: messageFrom(s.last) } : {}), unread: Number(s.unread ?? 0) };
};

export async function getOverview(): Promise<ChatOverview> {
  const { data } = await apiClient.get<unknown>("/messages/conversations");
  const d = rec(data) ?? {};
  const pods = list(d.pods).map((raw): ChatPod => {
    const p = rec(raw) ?? {};
    return { ...summaryFrom(p), taskId: Number(p.taskId), parentId: p.parentId == null ? null : Number(p.parentId), code: String(p.code ?? ""), title: String(p.title ?? ""), status: statusFromApi(p.status), done: p.done === true, members: list(p.members).map((m) => ({ id: String(rec(m)?.id), name: String(rec(m)?.name ?? "") })) };
  });
  return { pods, dms: Object.fromEntries(list(d.dms).map((x) => [String(rec(x)?.userId), summaryFrom(x)])) };
}

/** The messages of a conversation ("task:<task id>" or "dm:<person id>"), oldest first; `after` asks only for newer ones. */
export async function getMessages(conv: string, after = 0, withTickets = false): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<unknown>("/messages", { params: { conv, after, ...(withTickets ? { tickets: true } : {}) } });
  return list(rec(data)?.messages).map(messageFrom);
}

/** What goes with a message besides its words: its kind, a code snippet's language, the ids of the uploaded files, the message it replies to and the people mentioned. */
export type SendOptions = { kind?: MessageKind; lang?: string; fileIds?: number[]; replyTo?: number; mentionIds?: string[] };

export async function sendMessage(conv: string, text: string, o: SendOptions = {}): Promise<ChatMessage> {
  const { data } = await apiClient.post<unknown>("/messages", { conv, text, ...(o.kind && o.kind !== "text" ? { kind: o.kind } : {}), ...(o.lang ? { lang: o.lang } : {}), ...(o.fileIds?.length ? { fileIds: o.fileIds } : {}), ...(o.replyTo ? { replyTo: o.replyTo } : {}), ...(o.mentionIds?.length ? { mentionIds: o.mentionIds.map(Number) } : {}) });
  return messageFrom(data);
}

/** Step one of sending files: their details are checked and registered, and each gets an id to upload its bytes under. */
export async function registerFiles(conv: string, kind: FileKind, files: { name: string; type: string; size: number; duration?: number }[]): Promise<number[]> {
  const { data } = await apiClient.post<unknown>("/messages/files", { conv, kind, files });
  return list(rec(data)?.files).map((f) => Number(rec(f)?.id));
}

/** Step two: the bytes of one registered file, with the upload's progress (0 to 1) reported as it goes. Rejects with the reason on failure; `signal` cancels it. */
export function uploadFile(id: number, blob: Blob, onProgress: (done: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/chat-file/${id}`);
    xhr.setRequestHeader("x-koinbx-client", "1");
    xhr.setRequestHeader("content-type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return onProgress(1), resolve();
      let message = "The upload failed.";
      try { message = JSON.parse(xhr.responseText)?.error?.message ?? message; } catch { /* keep the default */ }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("The upload failed: the server could not be reached."));
    xhr.onabort = () => reject(new Error("The upload was cancelled."));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(blob);
  });
}

/** Where a sent file is read: shown in the page (`inline`, for pictures, video, audio and PDFs) or downloaded. */
export const fileUrl = (id: number, mode: "inline" | "download" = "inline") => `/api/chat-file/${id}?${mode === "download" ? "download=1" : "inline=1"}`;

/** Changes the words of the person's own text message. */
export async function editMessage(conv: string, id: number, text: string): Promise<ChatMessage> {
  const { data } = await apiClient.post<unknown>("/messages/edit", { conv, id, text });
  return messageFrom(data);
}

/** Gives or takes back a reaction; answers the message's reactions as they are now. */
export async function reactMessage(conv: string, id: number, emoji: string): Promise<Record<string, string[]>> {
  const { data } = await apiClient.post<unknown>("/messages/react", { conv, id, emoji });
  return Object.fromEntries(Object.entries(rec(rec(data)?.reactions) ?? {}).map(([e, ids]) => [e, list(ids).map(String)]));
}

/** Tells the others in a conversation that the person has started (or stopped) typing. Nothing is saved. */
export async function setTyping(conv: string, typing: boolean): Promise<void> {
  await apiClient.post("/messages/typing", { conv, typing });
}

/** Who else is typing now, by conversation. */
export async function getTyping(convs: string[]): Promise<Record<string, string[]>> {
  const { data } = await apiClient.get<unknown>("/messages/typing", { params: { convs: convs.join(",") } });
  return Object.fromEntries(Object.entries(rec(rec(data)?.typing) ?? {}).map(([k, names]) => [k, list(names).map(String)]));
}

export async function markRead(conv: string, withTickets = false): Promise<void> {
  await apiClient.post("/messages/read", { conv, ...(withTickets ? { tickets: true } : {}) });
}

/** Deletes a message. `scope` "everyone": the person's own message, within 30 hours, stays as "This message was deleted" for all; "me": it is hidden from this person only. `conv` is the conversation it is in. */
export async function deleteMessage(conv: string, id: number, scope: "everyone" | "me"): Promise<void> {
  await apiClient.post("/messages/delete", { conv, id, scope });
}

const KIND_LABEL: Record<string, string> = { image: "Photo", video: "Video", audio: "Voice message", code: "Code snippet", file: "File" };
/** One line saying what a message is, for the conversation list and the notices (its words, or what kind of message it is). */
export const previewOf = (m: ChatMessage) => (m.deleted ? "message deleted" : m.text && m.kind !== "code" ? m.text : m.kind ? `${KIND_LABEL[m.kind] ?? "Message"}${m.kind === "code" && m.lang ? ` (${m.lang})` : ""}` : m.text);
