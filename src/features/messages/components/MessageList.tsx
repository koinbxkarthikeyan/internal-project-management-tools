import { useEffect, useState } from "react";
import { REACTIONS } from "@/lib/chatConfig";
import { TrashIcon } from "@/components/ui/icons";
import ModalClose from "@/components/ui/ModalClose";
import type { ChatMessage } from "@/services/messageService";
import Avatar from "./Avatar";
import MessageBody from "./MessageBody";

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const diff = Math.round((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
/** Messages from the same person within this many minutes are one group. */
const GROUP_MS = 5 * 60_000;

/** Ticks on a message the person sent, as in WhatsApp: one grey tick once it is sent, two light-blue ticks once the others have read it. */
function Ticks({ read }: { read: boolean }) {
  return (
    // Read ticks are the chat-app blue (the same in light and dark); sent ticks are the muted grey.
    <span role="img" aria-label={read ? "Read" : "Sent"} className={`inline-flex shrink-0 ${read ? "text-[#53bdeb]" : "text-muted"}`}>
      <svg viewBox="0 0 20 12" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m1.5 6.5 3.2 3.2L11 2.5" />
        {read && <path d="m8.2 8.6 1.1 1.1L18 2.5" />}
      </svg>
    </span>
  );
}

/** The trash in a message's time line (shown when the message is hovered): it opens the delete choices. */
function DeleteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label="Delete message" title="Delete message" className="grid size-4 shrink-0 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-red-600 group-hover/msg:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent">
      <TrashIcon width={12} height={12} />
    </button>
  );
}

/**
 * The box for deleting a message, centred over the conversation panel it is in (not the whole screen). It shows which message it is, then two clear choices: "Delete for everyone"
 * (the person's own message, within 30 hours: it stays in the chat as "This message was deleted") and "Delete for me" (hides it from this person only, at any time).
 */
function DeleteDialog({ message, who, mine, canEveryone, onChoose, onClose }: { message: ChatMessage; who: string; mine: boolean; canEveryone: boolean; onChoose: (scope: "everyone" | "me") => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  async function choose(scope: "everyone" | "me") {
    setBusy(true);
    try {
      await onChoose(scope);
      onClose();
    } catch {
      setBusy(false); // refused: the page said why; the choices stay
    }
  }
  const option = "flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/40 px-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()} onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}>
      <div role="alertdialog" aria-labelledby="delete-message-title" className="anim-fade-up w-full max-w-sm overflow-hidden card shadow-modal">
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-300">
            <TrashIcon width={16} height={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="delete-message-title" className="text-base font-semibold leading-tight">Delete message?</h2>
            <p className="mt-0.5 text-xs text-muted">Choose how it should be deleted.</p>
          </div>
          <ModalClose onClick={onClose} />
        </header>
        <div className="flex flex-col gap-3 px-5 py-4">
          <blockquote className="rounded-lg border-l-2 border-border bg-hover px-3 py-2 text-sm">
            <span className="block text-xs font-semibold text-muted">{mine ? "You" : who} · {hhmm(message.createdAt)}</span>
            <span className="line-clamp-2 [overflow-wrap:anywhere]">{message.text}</span>
          </blockquote>
          <div className="flex flex-col gap-2">
            <button type="button" autoFocus={canEveryone} disabled={busy || !canEveryone} onClick={() => void choose("everyone")} className={`${option} border-red-500/30 hover:bg-red-500/10`}>
              <span className="text-sm font-semibold text-red-600 dark:text-red-300">Delete for everyone</span>
              <span className="text-xs text-muted">{canEveryone ? "Everyone in this chat will see \u201cThis message was deleted\u201d." : mine ? "Only possible within 30 hours of sending it." : "You can do this only for your own messages."}</span>
            </button>
            <button type="button" autoFocus={!canEveryone} disabled={busy} onClick={() => void choose("me")} className={`${option} border-border hover:bg-hover`}>
              <span className="text-sm font-semibold">Delete for me</span>
              <span className="text-xs text-muted">Removes it from your view only. Others still see it.</span>
            </button>
          </div>
        </div>
        <footer className="flex justify-end border-t border-border bg-hover/40 px-5 py-3">
          <button type="button" disabled={busy} onClick={onClose} className="h-9 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">Cancel</button>
        </footer>
      </div>
    </div>
  );
}

/** The messages of one conversation: each person's avatar, name and time open a group, the group's messages sit under it, and the days are told apart by a label. */
export default function MessageList({ messages, myId, nameOf, newFrom = null, tagOf, onDelete, deleteOthers = false, onReply, onEdit, onReact, onOpenTicket, highlightId, compact = false }: { messages: readonly ChatMessage[]; myId: string; nameOf: (id: string) => string; newFrom?: number | null; /** A label shown beside the name of a group (the Ticket a message belongs to). */ tagOf?: (m: ChatMessage) => string | undefined; /** Deletes a message: for everyone (the person's own, within 30 hours) or for the person only. When given, every message has a delete icon. */ onDelete?: (m: ChatMessage, scope: "everyone" | "me") => Promise<void>; /** The other people's messages can be deleted (for oneself, or by an admin) too: a group chat. In a direct chat only the person's own messages have the delete icon. */ deleteOthers?: boolean; /** Replies to a message: it is quoted in the next one. */ onReply?: (m: ChatMessage) => void; /** Changes the words of the person's own text message (within 30 minutes). */ onEdit?: (m: ChatMessage, text: string) => Promise<void>; /** Gives or takes back a reaction. */ onReact?: (m: ChatMessage, emoji: string) => Promise<void>; /** Opens the Ticket a "created Ticket …" note points to. */ onOpenTicket?: (ticket: { id: number; code: string }) => void; /** A message to bring attention to (a notification pointed to it): it is ringed. */ highlightId?: number; /** A smaller version for a narrow place (a card, a row): smaller avatars and tighter spacing; everything else is the same. */ compact?: boolean }) {
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<{ id: number; draft: string } | null>(null);
  const [reacting, setReacting] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  // The reaction picker closes on a click anywhere outside it, on Escape, and when the pointer leaves the message.
  useEffect(() => {
    if (reacting === null) return;
    const away = (e: PointerEvent) => !(e.target as HTMLElement).closest?.("[data-reaction-ui]") && setReacting(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setReacting(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("pointerdown", away), document.removeEventListener("keydown", esc));
  }, [reacting]);
  const copy = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.text || (m.files ?? []).map((f) => f.name).join(", "));
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1500);
    } catch {
      // clipboard blocked: nothing to copy to
    }
  };
  // The edit pencil of a message goes away by itself when its 30 minutes are over (the server enforces it too).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const editable = (m: ChatMessage) => !m.deleted && (!m.kind || m.kind === "text") && now - Date.parse(m.createdAt) <= 30 * 60_000;
  const act = "grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent";
  const same = (a?: ChatMessage, b?: ChatMessage) => !!a && !!b && a.fromId === b.fromId && a.taskId === b.taskId && dayLabel(a.createdAt) === dayLabel(b.createdAt) && Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < GROUP_MS;
  return (
    <>
    <ul className="flex flex-col">
      {messages.map((m, i, all) => {
        const mine = m.fromId === myId;
        const prev = all[i - 1];
        const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
        const first = !same(prev, m);
        const name = nameOf(m.fromId);
        return (
          <li key={m.id} id={`message-${m.id}`} className={first ? (compact ? "mt-2" : "mt-3") : "mt-0.5"}>
            {m.id === newFrom && !mine && (
              <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-accent" role="separator">
                <span className="h-px flex-1 bg-accent/40" />
                New messages
                <span className="h-px flex-1 bg-accent/40" />
              </div>
            )}
            {newDay && (
              <div className="my-3 flex justify-center">
                <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-[11px] font-medium text-muted shadow-sm">{dayLabel(m.createdAt)}</span>
              </div>
            )}
            <div onMouseLeave={() => reacting === m.id && setReacting(null)} className={`group/msg flex items-start gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
              {first ? <Avatar name={name} size={compact ? 24 : 30} /> : <span className={compact ? "w-6 shrink-0" : "w-[30px] shrink-0"} />}
              <div className={`flex min-w-0 max-w-[85%] flex-col ${mine ? "items-end" : "items-start"}`}>
                {first && (
                  <div className={`mb-1 flex items-baseline gap-2 px-0.5 ${mine ? "flex-row-reverse" : ""}`}>
                    <span className="text-sm font-semibold">{mine ? "You" : name}</span>
                    {tagOf?.(m) && <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">{tagOf(m)}</span>}
                  </div>
                )}
                <div className="relative max-w-full">
                  {/* What can be done with a message, shown when it is hovered (or focused): react, reply, copy, edit (own text, 30 minutes) and delete. */}
                  {!m.deleted && (onReact || onReply || onEdit || onDelete) && (
                    <div className={`absolute -top-3.5 z-10 hidden items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-menu group-focus-within/msg:flex group-hover/msg:flex ${mine ? "right-1" : "left-1"}`}>
                      {onReact && <button type="button" data-reaction-ui onClick={() => setReacting(reacting === m.id ? null : m.id)} aria-label="React to message" aria-expanded={reacting === m.id} className={act}>☺</button>}
                      {onReply && <button type="button" onClick={() => onReply(m)} aria-label="Reply to message" className={act}>↩</button>}
                      <button type="button" onClick={() => void copy(m)} aria-label="Copy message" className={act}>{copied === m.id ? "✓" : "⧉"}</button>
                      {onEdit && mine && editable(m) && <button type="button" onClick={() => setEditing({ id: m.id, draft: m.text })} aria-label="Edit message" className={act}>✎</button>}
                      {onDelete && (mine || deleteOthers) && <DeleteButton onOpen={() => setDeleting(m)} />}
                    </div>
                  )}
                  {reacting === m.id && onReact && (
                    <div role="listbox" data-reaction-ui aria-label="Reactions" className={`absolute -top-12 z-20 flex gap-0.5 rounded-xl border border-border bg-surface p-1 shadow-menu ${mine ? "right-1" : "left-1"}`}>
                      {REACTIONS.map((e) => <button key={e} type="button" role="option" aria-selected="false" onClick={() => (setReacting(null), void onReact(m, e))} className="grid size-8 place-items-center rounded-lg text-lg hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">{e}</button>)}
                    </div>
                  )}
                  {/* The content, and at the bottom right the time (with the ticks): the time line is as tall as one line of text, so on a short message the two sit level. */}
                  <div className={`flex flex-col gap-1.5 rounded-xl text-sm leading-relaxed ${compact ? "px-3 py-1.5" : "px-3.5 py-2"} ${mine ? "bg-accent-soft" : "bg-hover"} ${m.deleted ? "opacity-80" : ""} ${highlightId === m.id ? "ring-2 ring-accent" : ""}`}>
                    {m.replyTo && !m.deleted && (
                      <span className="flex min-w-0 flex-col rounded-md border-l-2 border-accent bg-background/60 px-2 py-1 text-xs">
                        <span className="font-semibold text-accent">{m.replyTo.fromId === myId ? "You" : nameOf(m.replyTo.fromId)}</span>
                        <span className="truncate text-muted">{m.replyTo.deleted ? "This message was deleted" : m.replyTo.text || "Message"}</span>
                      </span>
                    )}
                    <span className="flex items-end gap-3">
                      {m.deleted ? (
                        // A deleted message stays in the chat as a notice, for both people.
                        <span className="flex min-w-0 items-center gap-1.5 italic text-muted">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>
                          {mine ? "You deleted this message" : "This message was deleted"}
                        </span>
                      ) : editing?.id === m.id ? (
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <textarea
                            value={editing.draft}
                            onChange={(e) => setEditing({ id: m.id, draft: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditing(null);
                              else if (e.key === "Enter" && !e.shiftKey && onEdit && editing.draft.trim() && editing.draft.trim() !== m.text) {
                                e.preventDefault();
                                void onEdit(m, editing.draft.trim()).then(() => setEditing(null), () => undefined);
                              }
                            }}
                            autoFocus
                            rows={2}
                            aria-label="Edit message"
                            style={{ outline: "none" }}
                            className="field w-full min-w-[12rem] resize-none px-2 py-1.5 text-sm"
                          />
                          <span className="flex justify-end gap-2 text-xs">
                            <button type="button" onClick={() => setEditing(null)} className="rounded px-2 py-1 font-medium text-muted hover:bg-border">Cancel</button>
                            <button type="button" disabled={!editing.draft.trim() || editing.draft.trim() === m.text || !onEdit} onClick={() => onEdit && void onEdit(m, editing.draft.trim()).then(() => setEditing(null), () => undefined)} className="rounded bg-accent px-2 py-1 font-semibold text-accent-foreground disabled:opacity-40">Save</button>
                          </span>
                        </span>
                      ) : (
                        <MessageBody m={m} onOpenTicket={onOpenTicket} />
                      )}
                      <span className="flex h-[1.4rem] shrink-0 items-center gap-1 self-end text-[10px] leading-none text-muted">
                        {m.edited && !m.deleted && <span>edited</span>}
                        {hhmm(m.createdAt)}
                        {mine && !m.deleted && <Ticks read={m.read === true} />}
                      </span>
                    </span>
                  </div>
                  {!m.deleted && m.reactions && Object.keys(m.reactions).length > 0 && (
                    <div className={`-mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
                      {Object.entries(m.reactions).map(([e, ids]) => (
                        <button key={e} type="button" onClick={() => onReact && void onReact(m, e)} aria-label={`${e} ${ids.length}, ${ids.map((id) => (id === myId ? "you" : nameOf(id))).join(", ")}`} title={ids.map((id) => (id === myId ? "You" : nameOf(id))).join(", ")} className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${ids.includes(myId) ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}>
                          {e}<span className="tabular-nums text-muted">{ids.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
    {deleting && onDelete && <DeleteDialog message={deleting} who={nameOf(deleting.fromId)} mine={deleting.fromId === myId} canEveryone={deleting.canDelete === true} onChoose={(scope) => onDelete(deleting, scope)} onClose={() => setDeleting(null)} />}
    </>
  );
}
