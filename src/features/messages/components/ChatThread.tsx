"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/apiClient";
import type { ChatMessage, SendOptions } from "@/services/messageService";
import Composer, { type Person } from "./Composer";
import MessageList from "./MessageList";
import TypingLine from "./TypingLine";
import { useTypingNames, useTypingSender } from "./useTyping";
import type { useThread } from "./useThread";

/** Where a conversation is shown: a whole panel or page ("page"), beside other things ("side"), or inside a narrow card or row ("compact"). The design is the same; only the room it takes differs. */
export type ThreadSize = "page" | "side" | "compact";

/**
 * The body of every conversation in the app — the messages (with their tools: reply, copy, react, edit, delete), the "New messages" line, scrolling and the message box — so a
 * direct chat, a POD chat, a task's chat on its page, in a card or in a row all look and behave the same. What differs is passed in: the messages and what can be done with
 * them (from `useThread`), who can be mentioned, whether other people's messages can be deleted, and how much room there is (`size`).
 */
export default function ChatThread({
  thread,
  messages,
  convKey,
  label,
  myId,
  nameOf,
  people,
  deleteOthers = false,
  size = "page",
  newFrom,
  tagOf,
  highlightId,
  onOpenTicket,
  onPlus,
  placeholder,
  empty,
  composer,
  className = "",
}: {
  thread: Pick<ReturnType<typeof useThread>, "send" | "remove" | "edit" | "react">;
  /** The messages to show (null while they are being read). */
  messages: ChatMessage[] | null;
  /** The conversation a new message goes to. */
  convKey: string;
  label: string;
  myId: string;
  nameOf: (id: string) => string;
  people?: readonly Person[];
  deleteOthers?: boolean;
  size?: ThreadSize;
  newFrom?: number | null;
  tagOf?: (m: ChatMessage) => string | undefined;
  /** A message to scroll to and ring (a notification pointed to it). */
  highlightId?: number;
  onOpenTicket?: (ticket: { id: number; code: string }) => void;
  onPlus?: () => void;
  placeholder?: string;
  /** What to show when there are no messages yet. */
  empty?: ReactNode;
  /** Replaces the message box (a status change asks for its comment instead). */
  composer?: ReactNode;
  /** Extra classes for the scrolling message area (its height). */
  className?: string;
}) {
  const toast = useToast();
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const jumped = useRef(false);
  const compact = size === "compact";
  const typingNames = useTypingNames(convKey);
  const reportTyping = useTypingSender(convKey);

  // Stay at the newest message unless the person has scrolled up to read (then a new message doesn't pull them away); a message a notification pointed to is brought into view once.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || messages === null) return;
    if (highlightId != null && !jumped.current) {
      const at = box.querySelector<HTMLElement>(`#message-${highlightId}`);
      if (at) {
        at.scrollIntoView({ block: "center" });
        jumped.current = true;
        return;
      }
    }
    const last = messages.at(-1);
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
    if (nearBottom || last?.fromId === myId || box.scrollTop === 0) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, myId, highlightId]);

  const failed = (err: unknown) => (toast.show(getErrorMessage(err), "danger"), Promise.reject(err));
  return (
    <>
      <div ref={scrollRef} aria-live="polite" role="log" aria-label="Conversation" className={`min-h-0 overflow-y-auto overscroll-contain ${compact ? "px-2 py-2" : "px-3 py-3"} ${className}`}>
        {messages === null && <p className="mt-6 text-center text-sm text-muted" role="status">Loading messages…</p>}
        {messages?.length === 0 && (empty ?? <p className="mt-8 text-center text-sm text-muted">No messages yet. Say hello.</p>)}
        {messages && messages.length > 0 && (
          <MessageList
            messages={messages}
            myId={myId}
            nameOf={nameOf}
            newFrom={newFrom}
            tagOf={tagOf}
            compact={compact}
            highlightId={highlightId}
            onOpenTicket={onOpenTicket}
            deleteOthers={deleteOthers}
            onReply={setReply}
            onEdit={(m, t) => thread.edit(m, t).catch(failed)}
            onReact={(m, e) => thread.react(m, e).catch((err) => void failed(err).catch(() => undefined))}
            onDelete={(m, scope) => thread.remove(m, scope).catch(failed)}
          />
        )}
        <div ref={endRef} />
      </div>
      <TypingLine names={typingNames} direct={convKey.startsWith("dm:")} compact={compact} />
      {composer ?? (
        <Composer
          label={label}
          convKey={convKey}
          people={people}
          compact={compact}
          onPlus={onPlus}
          placeholder={placeholder}
          onTyping={reportTyping}
          onSend={(text, o: SendOptions) => thread.send(text, convKey, o)}
          reply={reply ? { id: reply.id, who: reply.fromId === myId ? "yourself" : nameOf(reply.fromId), text: reply.text || (reply.files?.[0]?.name ?? reply.kind ?? "Message") } : null}
          onCancelReply={() => setReply(null)}
        />
      )}
    </>
  );
}
