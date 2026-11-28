"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SearchableSelect } from "@/components/ui/FormControls";
import { SendIcon } from "@/components/ui/icons";
import { getErrorMessage } from "@/lib/apiClient";
import { CHAT_LIMITS, CODE_LANGUAGES, EXTENSIONS, checkFile, sizeText, type FileKind } from "@/lib/chatConfig";
import * as chat from "@/services/messageService";
import { EMOJI_GROUPS } from "../emojis";
import CodeBlock from "./CodeBlock";
import FormatToolbar, { shortcut, type Change } from "./FormatToolbar";
import MediaViewer from "./MediaViewer";
import PreviewModal from "./PreviewModal";
import UploadDialog from "./UploadDialog";
import VoicePlayer from "./VoicePlayer";

const MAX = CHAT_LIMITS.textChars;

export type Person = { id: string; name: string };
type Panel = "emoji" | "mention" | "attach" | null;
/** A file chosen to send: its upload state is kept here until the message goes. */
type Pending = { key: string; file: Blob; name: string; size: number; kind: FileKind; duration?: number; preview?: string; id?: number; status: "ready" | "uploading" | "done" | "failed"; progress: number; error?: string };
type Voice = { state: "idle" } | { state: "denied"; message: string } | { state: "recording" | "paused"; seconds: number } | { state: "preview"; seconds: number; blob: Blob; url: string };

// Every tool of the row answers a hover or focus the same way: a soft grey box with a thin border, and the icon in teal.
const tool = "group/tool grid h-8 min-w-8 shrink-0 place-items-center rounded-lg border border-transparent px-1.5 @max-md:h-7 @max-md:min-w-7 @max-md:px-1 text-muted transition-[background-color,border-color,color] duration-150 hover:border-border hover:bg-hover hover:text-teal-600 focus-visible:border-border focus-visible:bg-hover focus-visible:text-teal-600 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-muted";
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const ACCEPT: Record<FileKind, string> = { image: ".jpg,.jpeg,.png,.webp,.gif", video: ".mp4,.webm,.mov", audio: "audio/*", file: EXTENSIONS.file.map((e) => `.${e}`).join(",") };
type Anchor = { left: number; top: number };
/**
 * A tool panel (attach menu, formatting, emoji, mention) drawn on the page above the button that opened it, not inside the conversation: a card or a narrow column clips what is inside it,
 * and the menu would be cut off. It stays above the button, as tall as the room above allows (it scrolls if that is short).
 */
function Panel({ anchor, width, className = "", children, ...rest }: { anchor: Anchor | null; width: number; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  if (!anchor) return null;
  return createPortal(
    <div
      data-composer-panel
      style={{ position: "fixed", left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)), bottom: window.innerHeight - anchor.top + 8, width, maxHeight: Math.max(140, anchor.top - 16) }}
      className={`anim-fade-up z-[70] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-menu ${className}`}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}

/** The same line icon style for every item of the attach menu. */
const ico = (paths: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);
const ATTACH: { kind: FileKind | "code" | "voice"; label: string; hint: string; icon: ReactNode }[] = [
  { kind: "image", label: "Photos & images", hint: "JPG, PNG, WEBP, GIF", icon: ico(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-9 9" /></>) },
  { kind: "video", label: "Videos", hint: "MP4, WEBM, MOV", icon: ico(<><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="m15 10.5 6-3v9l-6-3" /></>) },
  { kind: "voice", label: "Voice message", hint: "Record from the microphone", icon: ico(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>) },
  { kind: "file", label: "Documents & files", hint: "PDF, Office, TXT, CSV, ZIP…", icon: ico(<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>) },
  { kind: "code", label: "Code snippet", hint: "With syntax colours", icon: ico(<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />) },
];
let counter = 0;

/** A photo is stored smaller: scaled down to 1920px on its longer side and saved as WebP. Animated GIFs and anything the browser can't read are left alone, and so is a photo that would not get smaller. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.82));
    return blob && blob.type === "image/webp" && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" }) : file;
  } catch {
    return file;
  }
}

/** The length of a video, read from the file itself (the browser measures it); 0 when it can't be. */
const videoLength = (url: string) =>
  new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });

/**
 * The box to write a message in, laid out like a chat app: the box, and under it a tool row — attach (photos, videos, a voice message, documents, a code snippet), text formatting,
 * emoji, @ mention — with Send on the right. Files are checked against the limits in chatConfig as they are chosen, shown above the box with their size, a caption can be written, and
 * on Send they are registered and uploaded with a progress bar each (a failed one can be retried) before the message is sent. A voice message is recorded here (pause, resume,
 * cancel, a preview before sending). Enter sends, Shift + Enter starts a new line.
 */
export default function Composer({ label, convKey, people = [], reply, onCancelReply, onSend, onTyping, compact = false, onPlus, placeholder }: { /** Told whether the box has something typed in it (true) or is empty / was just sent (false): the "is typing…" line others see. */ onTyping?: (typing: boolean) => void; label: string; /** A smaller box for a narrow place (a card, a row): one line of text and a lower toolbar; every tool is still there. */ compact?: boolean; /** Typing + into the empty box calls this (the new Ticket form) and is never sent as a message. */ onPlus?: () => void; /** Replaces the usual "Message in …" placeholder. */ placeholder?: string; /** The conversation the message goes to (files are registered against it). */ convKey: string; people?: readonly Person[]; /** The message being replied to. */ reply?: { id: number; who: string; text: string } | null; onCancelReply?: () => void; onSend: (text: string, o: chat.SendOptions) => Promise<void> }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  /** The formatting row above the text, shown or hidden by the "Aa" button (hidden at first, as in a chat app). */
  const [bar, setBar] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  /** Opens a tool panel above the button that was clicked, or closes it when it is the one open. */
  const toggle = (name: Exclude<Panel, null>, button: HTMLElement) => {
    const r = button.getBoundingClientRect();
    setAnchor({ left: r.left, top: r.top });
    setPanel(panel === name ? null : name);
  };
  const [mentions, setMentions] = useState<Person[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  // The upload window (files, a comment, Share) is open after files are chosen; Esc hides it and the files stay in the box below. Voice messages skip it.
  const [review, setReview] = useState(false);
  const [code, setCode] = useState<{ lang: string; text: string } | null>(null);
  const hasText = draft.trim().length > 0 || !!code?.text.trim();
  useEffect(() => onTyping?.(hasText), [hasText, draft, code?.text, onTyping]);
  const [voice, setVoice] = useState<Voice>({ state: "idle" });
  // What is open in a viewer before sending: a picture, a video or a document (by its key in `pending`), with a temporary address for documents.
  const [viewing, setViewing] = useState<{ key: string; url?: string } | null>(null);
  const [codePreview, setCodePreview] = useState(false);
  // The emoji picker: the group shown, and the few used last (kept in this browser).
  const [emojiGroup, setEmojiGroup] = useState("smileys");
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("koinbx.recentEmoji") ?? "[]");
      return Array.isArray(saved) ? saved.filter((e): e is string => typeof e === "string").slice(0, 16) : [];
    } catch {
      return [];
    }
  });
  const pickEmoji = (e: string) => {
    insert(e);
    const next = [e, ...recent.filter((x) => x !== e)].slice(0, 16);
    setRecent(next);
    try {
      localStorage.setItem("koinbx.recentEmoji", JSON.stringify(next));
    } catch {
      // not remembered
    }
  };
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const inputs = useRef<Partial<Record<FileKind, HTMLInputElement | null>>>({});
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastLang = useRef("javascript");

  // The box grows with what is typed (up to a limit) and shrinks back after sending.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, code, voice.state]);

  // An open tool panel closes on a click outside it or on Escape.
  useEffect(() => {
    if (!panel) return;
    const away = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-composer-panel]") && setPanel(null);
    const esc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("pointerdown", away), document.removeEventListener("keydown", esc));
  }, [panel]);

  // Leaving the page (or the conversation) stops the microphone and frees the previews.
  useEffect(() => () => (stopStream(), clearInterval(timer.current)), []);
  function stopStream() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  /** Puts `text` where the cursor is (replacing what is selected) and leaves the cursor after it. */
  function insert(text: string, wrap?: [string, string]) {
    const el = areaRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const selected = draft.slice(start, end);
    const put = wrap ? `${wrap[0]}${selected || "text"}${wrap[1]}` : text;
    setDraft(`${draft.slice(0, start)}${put}${draft.slice(end)}`.slice(0, MAX));
    requestAnimationFrame(() => {
      el?.focus();
      const at = start + put.length;
      el?.setSelectionRange(wrap && !selected ? start + wrap[0].length : at, wrap && !selected ? start + wrap[0].length + 4 : at);
    });
  }

  /** Runs one of the formatting edits on the selected words and puts the selection back where the edit says. */
  function format(change: Change) {
    const el = areaRef.current;
    const done = change(draft, el?.selectionStart ?? draft.length, el?.selectionEnd ?? draft.length);
    if (done.text.length > MAX) return;
    setDraft(done.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(done.from, done.to);
    });
  }

  // ---- files ----
  const kindInTray = pending[0]?.kind;
  async function addFiles(kind: FileKind, list: FileList | File[]) {
    setFailed("");
    const files = [...list];
    if (kindInTray && kindInTray !== kind) return setFailed("Send or remove the files already chosen first (a message holds one kind of file).");
    if (pending.length + files.length > CHAT_LIMITS.filesPerMessage) return setFailed(`A message can have at most ${CHAT_LIMITS.filesPerMessage} files.`);
    const added: Pending[] = [];
    for (let file of files) {
      if (kind === "image") file = await shrinkImage(file);
      const problem = checkFile({ name: file.name, type: file.type, size: file.size }, kind);
      if (problem) {
        setFailed(problem);
        continue;
      }
      const preview = kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined;
      if (preview) previews.current.push(preview);
      added.push({ key: `f${++counter}`, file, name: file.name, size: file.size, kind, preview, ...(kind === "video" && preview ? { duration: await videoLength(preview) } : {}), status: "ready", progress: 0 });
    }
    if (added.length) {
      setPending((p) => [...p, ...added]);
      if (kind !== "audio") setReview(true);
    }
  }
  const remove = (key: string) => setPending((p) => p.filter((x) => x.key !== key));
  const patch = (key: string, change: Partial<Pending>) => setPending((p) => p.map((x) => (x.key === key ? { ...x, ...change } : x)));

  // ---- voice ----
  async function startRecording() {
    setPanel(null);
    setFailed("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia)
      return setVoice({
        state: "denied",
        message: window.isSecureContext
          ? "This browser can't record audio."
          : "Recording needs a secure page. Open the app on https:// or http://localhost; browsers block the microphone on a plain http address.",
      });
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setVoice({ state: "denied", message: "The microphone is blocked. Allow it for this site in the browser's address bar, then try again." });
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    recorder.current = rec;
    rec.start(250);
    setVoice({ state: "recording", seconds: 0 });
    timer.current = setInterval(() => {
      setVoice((v) => {
        if (v.state !== "recording") return v;
        if (v.seconds + 1 >= CHAT_LIMITS.voiceSeconds) stopRecording();
        return { ...v, seconds: v.seconds + 1 };
      });
    }, 1000);
  }
  function stopRecording() {
    const rec = recorder.current;
    if (!rec || rec.state === "inactive") return;
    clearInterval(timer.current);
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
      stopStream();
      setVoice((v) => {
        const seconds = v.state === "recording" || v.state === "paused" ? v.seconds : 0;
        const url = URL.createObjectURL(blob);
        previews.current.push(url);
        return { state: "preview", seconds, blob, url };
      });
    };
    rec.stop();
  }
  function pauseResume() {
    const rec = recorder.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setVoice((v) => (v.state === "recording" ? { ...v, state: "paused" } : v));
    } else if (rec.state === "paused") {
      rec.resume();
      setVoice((v) => (v.state === "paused" ? { ...v, state: "recording" } : v));
    }
  }
  function cancelVoice() {
    clearInterval(timer.current);
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    stopStream();
    setVoice({ state: "idle" });
  }
  // The recording takes its place with the other files, so it goes through the same upload.
  function useRecording() {
    if (voice.state !== "preview") return;
    const type = voice.blob.type.split(";")[0] || "audio/webm";
    const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
    setPending([{ key: `f${++counter}`, file: voice.blob, name: `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`, size: voice.blob.size, kind: "audio", duration: voice.seconds, preview: voice.url, status: "ready", progress: 0 }]);
    setVoice({ state: "idle" });
  }

  // ---- viewing before sending ----
  const canView = (p: Pending) => p.kind === "image" || p.kind === "video" || (p.kind === "file" && /\.(pdf|txt|log|csv|json|xml|sql)$/i.test(p.name));
  function view(p: Pending) {
    // A document gets its own temporary address (typed so the browser shows it); pictures and videos already have one.
    const url = p.kind === "file" ? URL.createObjectURL(new Blob([p.file], { type: /\.pdf$/i.test(p.name) ? "application/pdf" : "text/plain" })) : undefined;
    setViewing({ key: p.key, url });
  }
  function closeView() {
    if (viewing?.url) URL.revokeObjectURL(viewing.url);
    setViewing(null);
  }
  const viewed = viewing ? pending.find((p) => p.key === viewing.key) : undefined;

  // ---- sending ----
  async function send() {
    if (sending) return;
    const text = draft.trim();
    const hasCode = !!code && !!code.text.trim();
    if (!text && !pending.length && !hasCode) return;
    setSending(true);
    setFailed("");
    try {
      const replyTo = reply?.id;
      const mentionIds = [...new Set(mentions.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id))];
      if (hasCode) {
        await onSend(code!.text, { kind: "code", lang: code!.lang, replyTo });
        setCode(null);
      } else if (pending.length) {
        const kind = pending[0].kind;
        // Step one: the files that are not registered yet are checked by the server and given ids.
        const fresh = pending.filter((p) => p.id == null);
        if (fresh.length) {
          const ids = await chat.registerFiles(convKey, kind, fresh.map((p) => ({ name: p.name, type: p.file.type || "application/octet-stream", size: p.size, duration: p.duration })));
          fresh.forEach((p, i) => (p.id = ids[i]));
          setPending((all) => all.map((p) => fresh.find((f) => f.key === p.key) ?? p));
        }
        // Step two: each file that is not uploaded yet goes up, with its progress shown; one that fails can be retried and the others are not sent again.
        const todo = pending.filter((p) => p.status !== "done");
        await Promise.all(
          todo.map(async (p) => {
            patch(p.key, { status: "uploading", progress: 0, error: undefined });
            try {
              await chat.uploadFile(p.id!, p.file, (d) => patch(p.key, { progress: d }));
              patch(p.key, { status: "done", progress: 1 });
              p.status = "done";
            } catch (err) {
              patch(p.key, { status: "failed", error: getErrorMessage(err) });
              throw err;
            }
          }),
        );
        await onSend(text, { kind, fileIds: pending.map((p) => p.id!), replyTo });
        setPending([]);
      } else {
        await onSend(text, { replyTo, mentionIds });
      }
      setDraft("");
      setMentions([]);
      setPanel(null);
      onCancelReply?.();
    } catch (err) {
      setFailed(pending.some((p) => p.status === "failed") ? "A file didn't upload. Retry to send again." : getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && panel) {
      e.preventDefault();
      setPanel(null);
    } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    } else if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Tab goes to the next chat box on the page (the toolbar buttons are for the mouse); with no other box after this one it moves on as usual.
      const boxes = [...document.querySelectorAll<HTMLTextAreaElement>("textarea[data-chat-input]")].filter((b) => b.offsetParent && !b.disabled);
      const next = boxes[boxes.indexOf(e.currentTarget) + 1];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    } else {
      const change = shortcut(e);
      if (change) {
        e.preventDefault();
        format(change);
      }
    }
  };

  const canSend = !sending && (!!draft.trim() || pending.length > 0 || (!!code && !!code.text.trim()));
  const picking = (k: FileKind) => (
    <input key={k} ref={(el) => void (inputs.current[k] = el)} type="file" multiple={k !== "audio"} accept={ACCEPT[k]} className="sr-only" tabIndex={-1} aria-label={`Choose ${k} files`} onChange={(e) => { if (e.target.files?.length) void addFiles(k, e.target.files); e.target.value = ""; }} />
  );

  return (
    <form ref={rootRef} onSubmit={(e) => (e.preventDefault(), void send())} className={`@container ${compact ? "px-2 pb-2 pt-1" : "px-3 pb-3 pt-1"}`}>
      {reply && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-2 border-accent bg-hover px-3 py-1.5 text-xs">
          <span className="min-w-0 flex-1"><span className="font-semibold text-accent">Replying to {reply.who}</span><span className="block truncate text-muted">{reply.text}</span></span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="rounded px-1.5 py-0.5 text-muted hover:bg-border hover:text-foreground">✕</button>
        </div>
      )}

      <div className="relative flex flex-col rounded-2xl border border-border bg-background shadow-sm transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_15%,transparent)]">
      {/* The files chosen, inside the box above the toolbar: what they are, how big, a way to take each out, and the upload's progress. */}
      {pending.length > 0 && (pending[0].kind === "image" || pending[0].kind === "video") && (
        // Pictures and videos: a grid of small tiles, so ten of them take two rows, not ten. Click a tile to view it; ✕ takes it out; a bar shows its upload.
        <div className="px-3 pt-3">
          <ul className="grid grid-cols-5 gap-1.5 @md:grid-cols-6" aria-label="Files to send">
            {pending.map((p) => (
              <li key={p.key} className={`group/tile relative aspect-square overflow-hidden rounded-lg border bg-hover ${p.status === "failed" ? "border-danger" : "border-border"}`} title={`${p.name} · ${sizeText(p.size)}${p.duration ? ` · ${clock(p.duration)}` : ""}${p.status === "failed" ? ` · ${p.error}` : ""}`}>
                <button type="button" onClick={() => (p.status === "failed" ? void send() : view(p))} aria-label={p.status === "failed" ? `Retry ${p.name}` : `View ${p.name}`} className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-accent">
                  {p.kind === "image" && p.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.preview} alt="" className="size-full object-cover" />
                  ) : p.preview ? (
                    <video src={p.preview} className="size-full bg-black object-cover" muted preload="metadata" />
                  ) : null}
                  {p.kind === "video" && <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-white drop-shadow"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>}
                  {p.kind === "video" && p.duration ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-medium tabular-nums text-white">{clock(p.duration)}</span> : null}
                  {p.status === "failed" && <span className="absolute inset-0 grid place-items-center bg-black/55 text-[10px] font-semibold text-white">Retry</span>}
                </button>
                <button type="button" onClick={() => remove(p.key)} disabled={p.status === "uploading"} aria-label={`Remove ${p.name}`} className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-[10px] text-white opacity-100 transition-opacity focus-visible:opacity-100 disabled:hidden md:opacity-0 md:group-hover/tile:opacity-100">✕</button>
                {p.status === "uploading" && <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30"><span style={{ width: `${Math.round(p.progress * 100)}%` }} className="block h-full bg-accent transition-[width] duration-150" /></span>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">{pending.length} {pending[0].kind === "image" ? (pending.length === 1 ? "photo" : "photos") : pending.length === 1 ? "video" : "videos"} · {sizeText(pending.reduce((n, p) => n + p.size, 0))}</p>
        </div>
      )}
      {pending.length > 0 && pending[0].kind !== "image" && pending[0].kind !== "video" && (
        <ul className="flex max-h-36 flex-col gap-1.5 overflow-y-auto px-3 pt-3" aria-label="Files to send">
          {pending.map((p) => (
            <li key={p.key} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-2.5 py-2">
              {p.kind === "image" && p.preview ? (
                <button type="button" onClick={() => view(p)} aria-label={`View ${p.name}`} className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-accent">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="size-10 rounded object-cover" />
                </button>
              ) : p.kind === "video" && p.preview ? (
                <button type="button" onClick={() => view(p)} aria-label={`View ${p.name}`} className="relative shrink-0 rounded focus-visible:outline-2 focus-visible:outline-accent">
                  <video src={p.preview} className="size-10 rounded bg-black object-cover" muted preload="metadata" />
                  <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-white"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
                </button>
              ) : p.kind === "audio" && p.preview ? (
                <VoicePlayer id={0} name={p.name} duration={p.duration} src={p.preview} />
              ) : (
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded bg-hover text-[10px] font-bold uppercase text-muted">{p.name.split(".").pop()}</span>
              )}
              {p.kind !== "audio" && (
                <span className="min-w-0 flex-1 text-xs">
                  <span className="block truncate font-medium" title={p.name}>{p.name}</span>
                  <span className={p.status === "failed" ? "text-danger" : "text-muted"}>{p.status === "failed" ? p.error : `${sizeText(p.size)}${p.duration ? ` · ${clock(p.duration)}` : ""}${p.status === "done" ? " · uploaded" : ""}`}</span>
                  {p.status === "uploading" && <span className="mt-1 block h-1 overflow-hidden rounded-full bg-hover"><span style={{ width: `${Math.round(p.progress * 100)}%` }} className="block h-full bg-accent transition-[width] duration-150" /></span>}
                </span>
              )}
              {p.kind === "audio" && <span className="min-w-0 flex-1" />}
              {canView(p) && <button type="button" onClick={() => view(p)} className="rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">View</button>}
              {p.status === "failed" && <button type="button" onClick={() => void send()} disabled={sending} className="rounded px-2 py-1 text-xs font-semibold text-accent hover:bg-hover">Retry</button>}
              <button type="button" onClick={() => remove(p.key)} disabled={p.status === "uploading"} aria-label={`Remove ${p.name}`} className="rounded px-1.5 py-0.5 text-muted hover:bg-hover hover:text-foreground disabled:opacity-40">✕</button>
            </li>
          ))}
        </ul>
      )}

        {bar && !code && voice.state === "idle" && <FormatToolbar onEdit={format} className="px-2.5 pt-2" />}
        {code ? (
          <div className="flex flex-col gap-2 px-3 pt-3">
            <div className="flex items-center justify-between gap-2">
              <SearchableSelect
                ariaLabel="Language"
                value={code.lang}
                onChange={(v) => ((lastLang.current = v), setCode({ ...code, lang: v }))}
                options={CODE_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                inputClassName="h-8 text-xs"
                className="w-40"
              />
              <span className="hidden text-[10px] text-muted @md:inline">{code.text.length}/{CHAT_LIMITS.codeChars} · Tab indents · Ctrl+Enter sends</span>
              <span className="flex gap-1">
                <button type="button" onClick={() => setCodePreview(!codePreview)} aria-pressed={codePreview} disabled={!code.text.trim()} className={`rounded px-2 py-0.5 text-xs font-medium hover:bg-hover disabled:opacity-40 ${codePreview ? "border-border bg-hover text-teal-600" : "text-accent"}`}>{codePreview ? "Edit" : "View"}</button>
              <button type="button" onClick={() => (setCode(null), setCodePreview(false))} className="rounded px-2 py-0.5 text-xs font-medium text-muted hover:bg-hover hover:text-foreground">Cancel</button>
              </span>
            </div>
            {codePreview ? (
              // How the snippet will look in the chat, with its colours.
              <CodeBlock code={code.text.replace(/^\n+|\s+$/g, "")} lang={code.lang} />
            ) : (
            <textarea
              value={code.text}
              onChange={(e) => setCode({ ...code, text: e.target.value.slice(0, CHAT_LIMITS.codeChars) })}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const s = el.selectionStart;
                  setCode({ ...code, text: `${code.text.slice(0, s)}  ${code.text.slice(el.selectionEnd)}` });
                  requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
                } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              autoFocus
              spellCheck={false}
              rows={6}
              placeholder="Paste or type the code"
              aria-label="Code"
              style={{ outline: "none" }}
              className="max-h-64 min-h-28 w-full resize-y rounded-lg border border-border bg-hover px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-muted"
            />
            )}
          </div>
        ) : voice.state !== "idle" ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-sm" role="group" aria-label="Voice message">
            {voice.state === "denied" ? (
              <>
                <p role="alert" className="min-w-0 flex-1 text-xs text-danger">{voice.message}</p>
                <button type="button" onClick={() => void startRecording()} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-hover">Try again</button>
                <button type="button" onClick={() => setVoice({ state: "idle" })} className="rounded px-2 py-1 text-xs text-muted hover:bg-hover">Close</button>
              </>
            ) : voice.state === "preview" ? (
              <>
                <div className="min-w-0 flex-1 basis-44"><VoicePlayer id={0} name="Recording" duration={voice.seconds} src={voice.url} /></div>
                <span className="ml-auto flex shrink-0 gap-2">
                  <button type="button" onClick={() => setVoice({ state: "idle" })} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-hover">Discard</button>
                  <button type="button" onClick={useRecording} className="btn-brand rounded-lg px-3 py-1.5 text-xs font-semibold">Attach</button>
                </span>
              </>
            ) : (
              <>
                <span className={`size-2.5 shrink-0 rounded-full bg-red-500 ${voice.state === "recording" ? "animate-pulse" : "opacity-40"}`} aria-hidden="true" />
                <span className="w-14 font-mono text-sm tabular-nums" role="timer" aria-label="Recording time">{clock(voice.seconds)}</span>
                <span className="hidden min-w-0 flex-1 truncate text-xs text-muted @md:inline">{voice.state === "recording" ? "Recording…" : "Paused"} · up to {Math.round(CHAT_LIMITS.voiceSeconds / 60)} min</span>
                <span className="ml-auto flex shrink-0 gap-2">
                  <button type="button" onClick={pauseResume} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-hover">{voice.state === "recording" ? "Pause" : "Resume"}</button>
                  <button type="button" onClick={cancelVoice} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-hover">Cancel</button>
                  <button type="button" onClick={stopRecording} className="btn-brand rounded-lg px-3 py-1.5 text-xs font-semibold">Stop</button>
                </span>
              </>
            )}
          </div>
        ) : (
          <textarea
            ref={areaRef}
            data-chat-input=""
            onPointerDown={() => setPanel(null)}
            // The box around it shows the focus (its border); the app's default ring would draw a second, square outline inside it.
            style={{ outline: "none" }}
            value={draft}
            onChange={(e) => {
              // Typing + into an empty box opens the new Ticket form at once (no Enter needed).
              setPanel(null);
              if (onPlus && draft === "" && e.target.value === "+") return onPlus();
              setDraft(e.target.value);
            }}
            onKeyDown={onKey}
            maxLength={MAX}
            rows={compact ? 1 : 2}
            placeholder={pending.length ? "Add a caption (optional)" : (placeholder ?? `Message in ${label}`)}
            aria-label={pending.length ? "Caption" : `Message in ${label}`}
            className={`max-h-40 min-w-0 resize-none overflow-y-auto bg-transparent px-3.5 text-base outline-none placeholder:text-muted md:text-sm ${compact ? "min-h-9 pb-0.5 pt-2" : "min-h-[3.25rem] pb-1 pt-3"}`}
          />
        )}

        {panel === "attach" && (
          <Panel anchor={anchor} width={240} role="menu" aria-label="Add attachment">
            {ATTACH.map((a) => (
              <button
                key={a.kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPanel(null);
                  if (a.kind === "voice") void startRecording();
                  else if (a.kind === "code") {
                    setPending([]);
                    setCode({ lang: lastLang.current, text: "" });
                  }
                  else inputs.current[a.kind]?.click();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-hover text-muted">{a.icon}</span>
                <span className="min-w-0"><span className="block text-sm font-medium">{a.label}</span><span className="block truncate text-xs text-muted">{a.hint}</span></span>
              </button>
            ))}
          </Panel>
        )}
        {panel === "emoji" && (
          <Panel anchor={anchor} width={288} role="dialog" aria-label="Emoji" className="p-0">
            <div role="tablist" aria-label="Emoji groups" className="flex gap-0.5 border-b border-border px-1.5 pt-1.5">
              {recent.length > 0 && <button type="button" role="tab" aria-selected={emojiGroup === "recent"} onClick={() => setEmojiGroup("recent")} title="Recently used" className={`grid h-8 flex-1 place-items-center rounded-t-md border-b-2 text-base ${emojiGroup === "recent" ? "border-accent bg-hover" : "border-transparent hover:bg-hover"}`}>🕘</button>}
              {EMOJI_GROUPS.map((g) => (
                <button key={g.id} type="button" role="tab" aria-selected={emojiGroup === g.id} onClick={() => setEmojiGroup(g.id)} title={g.label} className={`grid h-8 flex-1 place-items-center rounded-t-md border-b-2 text-base ${emojiGroup === g.id ? "border-accent bg-hover" : "border-transparent hover:bg-hover"}`}>{g.icon}</button>
              ))}
            </div>
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{emojiGroup === "recent" ? "Recently used" : EMOJI_GROUPS.find((g) => g.id === emojiGroup)?.label}</p>
            <div role="listbox" aria-label="Emoji" className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto px-1.5 pb-1.5">
              {(emojiGroup === "recent" ? recent : (EMOJI_GROUPS.find((g) => g.id === emojiGroup)?.emojis ?? [])).map((e) => (
                <button key={e} type="button" role="option" aria-selected="false" onClick={() => pickEmoji(e)} className="grid h-8 place-items-center rounded-lg text-lg transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">{e}</button>
              ))}
            </div>
          </Panel>
        )}
        {panel === "mention" && (
          <Panel anchor={anchor} width={224} role="listbox" aria-label="Mention someone">
            {people.length === 0 && <p className="px-3 py-2 text-xs text-muted">No one to mention here.</p>}
            {people.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected="false" onClick={() => (insert(`@${p.name} `), setMentions((m) => [...m, p]), setPanel(null))} className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">{p.name}</button>
            ))}
          </Panel>
        )}
        {(["image", "video", "audio", "file"] as const).map(picking)}

        <div className={`flex flex-wrap items-center gap-x-0.5 gap-y-1 px-2 pt-0.5 ${compact ? "pb-1.5" : "pb-2"}`}>
          <button type="button" onClick={(e) => toggle("attach", e.currentTarget)} aria-label="Add attachment" aria-haspopup="menu" aria-expanded={panel === "attach"} title="Add attachment" disabled={sending} className={`${tool} ${panel === "attach" ? "border-border bg-hover text-teal-600" : ""}`}>
            <svg className="transition-transform duration-200 ease-out group-hover/tool:rotate-90 group-focus-visible/tool:rotate-90" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" onClick={() => setBar(!bar)} aria-label="Formatting" aria-pressed={bar} title={bar ? "Hide formatting" : "Show formatting"} disabled={!!code || voice.state !== "idle"} className={`${tool} text-sm font-semibold ${bar ? "border-border bg-hover text-teal-600" : ""}`}><span className="inline-block transition-transform duration-200 ease-out group-hover/tool:scale-125 group-focus-visible/tool:scale-125">Aa</span></button>
          <button type="button" onClick={(e) => toggle("emoji", e.currentTarget)} aria-label="Emoji" aria-expanded={panel === "emoji"} title="Emoji" disabled={!!code || voice.state !== "idle"} className={`${tool} ${panel === "emoji" ? "border-border bg-hover text-teal-600" : ""}`}>
            <svg className="transition-transform duration-200 ease-out group-hover/tool:-rotate-12 group-hover/tool:scale-110 group-focus-visible/tool:-rotate-12" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>
          </button>
          <button type="button" onClick={(e) => toggle("mention", e.currentTarget)} aria-label="Mention someone" aria-expanded={panel === "mention"} title="Mention someone" disabled={!!code || voice.state !== "idle"} className={`${tool} ${panel === "mention" ? "border-border bg-hover text-teal-600" : ""}`}>
            <svg className="transition-transform duration-200 ease-out group-hover/tool:rotate-[24deg] group-hover/tool:scale-110 group-focus-visible/tool:rotate-[24deg]" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><path d="M15.5 8.5v5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8" /></svg>
          </button>
          <span className="mx-0.5 h-5 w-px bg-border @md:mx-1" aria-hidden="true" />
          <button type="button" onClick={() => inputs.current.video?.click()} aria-label="Attach a video" title="Attach a video" disabled={sending || !!code || voice.state !== "idle" || (!!kindInTray && kindInTray !== "video")} className={tool}>
            <svg className="transition-transform duration-200 ease-out group-hover/tool:translate-x-0.5 group-hover/tool:scale-110 group-focus-visible/tool:scale-110" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="m15 10.5 6-3v9l-6-3" /></svg>
          </button>
          <button type="button" onClick={() => void startRecording()} aria-label="Record a voice message" title="Record a voice message" disabled={sending || voice.state !== "idle" || !!code || pending.length > 0} className={tool}>
            <svg className="transition-transform duration-200 ease-out group-hover/tool:scale-125 group-focus-visible/tool:scale-125" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <span className="mx-0.5 h-5 w-px bg-border @md:mx-1" aria-hidden="true" />
          <button type="button" onClick={() => (setPending([]), setCode((c) => c ?? { lang: lastLang.current, text: "" }))} aria-label="Code snippet" title="Share a code snippet" disabled={sending || voice.state !== "idle"} className={`${tool} ${code ? "border-border bg-hover text-teal-600" : ""}`}>
            <svg className="transition-transform duration-200 ease-out group-hover/tool:scale-x-125 group-focus-visible/tool:scale-x-125" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></svg>
          </button>
          <div className="ml-auto min-w-0 flex-1 truncate px-1 text-right text-[10px] text-muted">
            {failed ? <span role="alert" className="text-danger" title={failed}>{failed}</span> : sending ? (pending.length ? "Uploading…" : "Sending…") : <span className={compact ? "hidden" : "hidden @lg:inline"}>Enter to send · Shift + Enter for a new line</span>}
          </div>
          <button type="submit" disabled={!canSend} aria-label={`Send message in ${label}`} className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 @max-md:h-7 @max-md:w-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {sending ? <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground" /> : <SendIcon width={15} height={15} />}
          </button>
        </div>
      </div>
      {review && pending.length > 0 && pending[0].kind !== "audio" && (
        <UploadDialog
          files={pending}
          comment={draft}
          onComment={setDraft}
          onRemove={remove}
          onAdd={() => inputs.current[pending[0].kind]?.click()}
          onCancel={() => (setPending([]), setReview(false))}
          onShare={() => void send()}
          onClose={() => setReview(false)}
          sending={sending}
          error={failed}
        />
      )}
      {viewed?.kind === "image" && (() => {
        const images = pending.filter((p) => p.kind === "image" && p.preview);
        return <MediaViewer files={images.map((p, i) => ({ id: -i - 1, name: p.name, url: p.preview }))} start={Math.max(0, images.findIndex((p) => p.key === viewed.key))} onClose={closeView} />;
      })()}
      {viewed?.kind === "video" && viewed.preview && (
        <PreviewModal title={viewed.name} onClose={closeView}>
          <video src={viewed.preview} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg bg-black" aria-label={viewed.name} />
        </PreviewModal>
      )}
      {viewed?.kind === "file" && viewing?.url && (
        <PreviewModal title={viewed.name} onClose={closeView}>
          <iframe src={viewing.url} title={`Preview of ${viewed.name}`} {...(/\.pdf$/i.test(viewed.name) ? {} : { sandbox: "" })} className="h-full w-full max-w-4xl rounded-lg bg-white" />
        </PreviewModal>
      )}
    </form>
  );
}
