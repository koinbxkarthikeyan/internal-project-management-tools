"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUsers } from "@/features/users/hooks/useUsers";
import { imageLog } from "@/lib/imageOptimizer";
import { IMAGE_ACCEPT, optimizeImages, sizeText, type OptimizedImage } from "@/services/attachmentService";
import type { Mention } from "@/services/commentService";
import Avatar from "./Avatar";

export type CommentDraft = { text: string; mentions: Mention[]; images: OptimizedImage[] };
export const EMPTY_DRAFT: CommentDraft = { text: "", mentions: [], images: [] };

/** The people actually still named in the text: a mention whose "@Name" was deleted is not sent. */
export const mentionedIn = (draft: Pick<CommentDraft, "text" | "mentions">) => draft.mentions.filter((m) => draft.text.includes(`@${m.name}`));

const MAX_COMMENT_IMAGES = 5;

const Clip = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>
);
const Send = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
);

/**
 * A chat-style message box. Typing "@" lists the people (name, avatar and team; narrowing as you type, arrows and Enter or a click pick one). The paperclip adds images
 * (or paste them), each previewed inside the box with Replace and Remove, and optimized like Ticket images. Enter sends, Shift + Enter makes a new line. Previews are
 * temporary addresses released when an image goes or the box closes.
 */
export default function CommentBox({ draft, onChange, onSend, sending = false, canSend, label, placeholder, rows = 2, images = true, sendLabel = "Send", bare = false }: { draft: CommentDraft; onChange: (d: CommentDraft) => void; onSend: () => void; sending?: boolean; canSend: boolean; label: string; placeholder?: string; rows?: number; images?: boolean; sendLabel?: string; /** For a field in a form (not a chat): no send button, Enter makes a new line. */ bare?: boolean }) {
  const users = useUsers();
  const area = useRef<HTMLTextAreaElement>(null);
  const add = useRef<HTMLInputElement>(null);
  const replace = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [pick, setPick] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const matches = useMemo(() => (pick ? users.filter((u) => u.name.toLowerCase().includes(pick.query.toLowerCase())).slice(0, 6) : []), [users, pick]);
  const open = !!pick && matches.length > 0;

  const previews = useMemo(() => draft.images.map((i) => URL.createObjectURL(i.file)), [draft.images]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function detect(text: string, caret: number) {
    const m = /(?:^|\s)@([\w.-]*(?: [\w.-]*){0,2})$/.exec(text.slice(0, caret));
    setPick(m ? { start: caret - m[1].length - 1, query: m[1] } : null);
    setActive(0);
  }

  function choose(user: { id: string; name: string }) {
    if (!pick) return;
    const el = area.current;
    const caret = el?.selectionStart ?? draft.text.length;
    const text = `${draft.text.slice(0, pick.start)}@${user.name} ${draft.text.slice(caret)}`;
    const at = pick.start + user.name.length + 2;
    onChange({ ...draft, text, mentions: draft.mentions.some((m) => m.id === user.id) ? draft.mentions : [...draft.mentions, { id: user.id, name: user.name }] });
    setPick(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  }

  async function take(chosen: File[], replaceAt: number | null) {
    if (chosen.length === 0) return;
    setBusy(true);
    const { ok, problems: bad } = await optimizeImages(chosen, replaceAt == null ? draft.images.length : draft.images.length - 1).finally(() => setBusy(false));
    const room = replaceAt == null ? MAX_COMMENT_IMAGES - draft.images.length : 1;
    setProblems([...bad, ...(ok.length > room ? [`Only ${MAX_COMMENT_IMAGES} images can go in one message.`] : [])]);
    if (ok.length === 0) return;
    if (replaceAt != null) {
      imageLog(`Image replaced: ${draft.images[replaceAt].file.name} → ${ok[0].file.name}`);
      onChange({ ...draft, images: draft.images.map((img, i) => (i === replaceAt ? ok[0] : img)) });
    } else onChange({ ...draft, images: [...draft.images, ...ok.slice(0, room)] });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative rounded-2xl border border-border bg-background transition-colors focus-within:border-accent">
        {open && (
          <ul id="mention-list" role="listbox" aria-label="People" className={`absolute left-0 z-30 max-h-56 w-72 max-w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-modal ${bare ? "top-full mt-1" : "bottom-full mb-1"}`}>
            {matches.map((u, i) => (
              <li key={u.id} id={`mention-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => (e.preventDefault(), choose(u))}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm ${i === active ? "bg-accent-soft text-accent" : "text-foreground"}`}
                >
                  <Avatar name={u.name} id={u.id} />
                  <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                  {u.team && <span className="shrink-0 text-[11px] text-muted">{u.team}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {draft.images.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-3 pt-3">
            {draft.images.map((img, i) => (
              <li key={`${img.file.name}-${img.file.size}-${i}`} className="relative w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previews[i]} alt={`Preview of ${img.file.name}`} className="size-20 rounded-lg border border-border bg-hover object-cover" />
                <button
                  type="button"
                  aria-label={`Remove ${img.file.name}`}
                  onClick={() => (imageLog(`Image removed: ${img.file.name}`), onChange({ ...draft, images: draft.images.filter((_, k) => k !== i) }))}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-border bg-surface text-[11px] leading-none text-muted shadow hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                >
                  ×
                </button>
                <span className="mt-0.5 flex items-center justify-between text-[10px] text-muted">
                  {sizeText(img.file.size)}
                  <button type="button" onClick={() => (setReplacing(i), replace.current?.click())} className="font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Replace</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={area}
          value={draft.text}
          rows={rows}
          aria-label={label}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="mention-list"
          aria-activedescendant={open ? `mention-${active}` : undefined}
          onChange={(e) => {
            onChange({ ...draft, text: e.target.value });
            detect(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => detect(draft.text, e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (open) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (a + 1) % matches.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a - 1 + matches.length) % matches.length);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                choose(matches[active]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setPick(null);
              }
              return;
            }
            // Enter sends; Shift + Enter is a new line.
            if (!bare && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend && !sending) onSend();
            }
          }}
          onBlur={() => setPick(null)}
          onPaste={
            images
              ? (e) => {
                  const pasted = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                  if (pasted.length) {
                    e.preventDefault();
                    void take(pasted, null);
                  }
                }
              : undefined
          }
          className="block max-h-40 min-h-12 w-full resize-none rounded-2xl bg-transparent px-3.5 py-2.5 text-sm placeholder:text-muted focus-visible:outline-none!"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1">
            {images && (
              <>
                <button type="button" aria-label="Attach images" title="Attach images" disabled={busy || draft.images.length >= MAX_COMMENT_IMAGES} onClick={() => add.current?.click()} className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
                  <Clip />
                </button>
                <input ref={add} type="file" multiple accept={IMAGE_ACCEPT} tabIndex={-1} aria-label="Choose images for the message" className="sr-only" onChange={(e) => (void take([...(e.target.files ?? [])], null), (e.target.value = ""))} />
                <input ref={replace} type="file" accept={IMAGE_ACCEPT} tabIndex={-1} aria-label="Choose a replacement image" className="sr-only" onChange={(e) => (replacing != null && void take([...(e.target.files ?? [])].slice(0, 1), replacing), setReplacing(null), (e.target.value = ""))} />
              </>
            )}
            <span className="text-[11px] text-muted">{busy ? "Optimizing…" : bare ? "@ to mention · paste or attach images" : "Enter to send · Shift + Enter for a new line · @ to mention"}</span>
          </div>
          {!bare && (<button type="button" aria-label={sendLabel} title={sendLabel} disabled={!canSend || sending || busy} onClick={onSend} className="btn-brand grid size-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
            <Send />
          </button>)}
        </div>
      </div>
      {problems.length > 0 && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{problems.join(" ")}</p>}
    </div>
  );
}

/** A comment's words with each @mention picked out. */
export function CommentText({ text, mentions }: { text: string; mentions: readonly Mention[] }) {
  const names = mentions.map((m) => `@${m.name}`).filter(Boolean);
  if (!names.length) return <>{text}</>;
  const pattern = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, i) => (names.includes(part) ? <span key={i} className="rounded bg-accent/15 px-1 font-semibold text-accent">{part}</span> : <span key={i}>{part}</span>))}
    </>
  );
}
