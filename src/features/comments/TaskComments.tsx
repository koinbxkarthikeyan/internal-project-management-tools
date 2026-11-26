"use client";

import { MESSAGES_LABEL, MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextAreaField } from "@/components/ui/FormControls";
import { useAuth } from "@/features/auth/hooks/useAuth";
import ChatThread from "@/features/messages/components/ChatThread";
import { useThread } from "@/features/messages/components/useThread";
import { useUsers } from "@/features/users/hooks/useUsers";
import * as chat from "@/services/messageService";
import { apiIdForCode } from "@/services/mappers";

/** When a status is being changed, the comment that goes with the change is typed in this section (it also becomes a message in the list once saved). */
export type StatusChangeComposer = { label: string; value: string; onChange: (v: string) => void; submitLabel: string; busy: boolean; onSubmit: () => void; onCancel: () => void };

/** The last message this person has seen on a task, kept in this browser: what is newer (and from someone else) is marked as new. */
const seenKey = (userId: string, taskId: string) => `koinbx.commentsSeen.${userId}.${taskId}`;
const readSeen = (key: string): number | null => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
};

/**
 * The conversation on one task or Ticket, where it is shown on its page, in a board card or in a list row. It is the same conversation as the task's chat in Work Chat and is drawn
 * by the same shared parts (ChatThread: the messages, their tools and the message box), so it looks and works exactly like any other chat in the app; only its size follows the place it
 * is in (`small` for a card or row, `fill` for the page). A notification link (`?comment=<id>`) scrolls to that message.
 */
export default function TaskComments({ taskId, reloadToken = 0, statusChange, fill = false, small = false, onNewTicket }: { taskId: string; /** A smaller conversation, for inside a card or a row (a board card is narrow). */ small?: boolean; /** Typing + into the empty message box opens this (the new Ticket form) at once; it is never sent as a message. */ onNewTicket?: () => void; /** Let the conversation use the height of the page (the task pages) instead of a short box. */ fill?: boolean; /** Changes when the list should be read again. */ reloadToken?: number; statusChange?: StatusChangeComposer }) {
  const { user, isQa, isAdmin } = useAuth();
  const users = useUsers();
  const router = useRouter();
  const target = Number(useSearchParams().get("comment")) || undefined;
  const apiId = apiIdForCode(taskId);
  const convKey = `task:${apiId ?? 0}`;
  const myId = user?.id ?? "";
  const thread = useThread(convKey, myId, 0, () => undefined, false, false, reloadToken);
  const { messages } = thread;

  // The "New messages" line: the first message from someone else newer than the last one this person had seen (kept in this browser).
  const key = seenKey(myId, taskId);
  const [seen] = useState(() => readSeen(key));
  const firstNew = useMemo(() => (messages && seen != null ? (messages.find((m) => m.id > seen && m.fromId !== myId)?.id ?? null) : null), [messages, seen, myId]);
  useEffect(() => {
    if (!messages?.length) return;
    try {
      localStorage.setItem(key, String(Math.max(...messages.map((m) => m.id))));
    } catch {
      // the marks just are not kept
    }
    // The conversation is read: its unread count in Work Chat clears.
    if (apiId != null && messages.some((m) => m.fromId !== myId)) void chat.markRead(convKey).catch(() => undefined);
  }, [messages, key, convKey, apiId, myId]);

  const nameOf = (id: string) => (id === myId ? "You" : (users.find((u) => u.id === id)?.name ?? "Someone"));
  const people = users.filter((u) => u.id !== myId && u.status !== "Disabled").map((u) => ({ id: u.id, name: u.name }));
  const newCount = firstNew != null && messages ? messages.filter((m) => m.id >= firstNew && m.fromId !== myId).length : 0;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${fill ? "min-h-0 flex-1" : ""}`}>
      <p className="shrink-0 text-xs font-medium text-muted">
        {MESSAGES_LABEL}{messages && messages.length > 0 ? ` (${messages.length})` : ""}
        {newCount > 0 && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">{newCount} new</span>}
      </p>
      <div className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface ${fill ? "min-h-[16rem] flex-1" : ""}`}>
        <ChatThread
          thread={thread}
          messages={messages}
          convKey={convKey}
          label={taskId}
          myId={myId}
          nameOf={nameOf}
          people={people}
          deleteOthers={isAdmin}
          size={small ? "compact" : fill ? "page" : "side"}
          newFrom={firstNew}
          highlightId={target}
          onOpenTicket={(t) => router.push(`${isQa || isAdmin ? READY_FOR_QA_HREF : MY_TASK_HREF}/ticket?id=${t.id}`)}
          onPlus={onNewTicket}
          placeholder={onNewTicket ? `Message in ${taskId} · + for a Ticket` : undefined}
          className={fill ? "max-h-[calc(100dvh-14rem)] min-h-40 flex-1" : small ? "max-h-[min(12rem,calc(100dvh-16rem))] min-h-16" : "max-h-[min(24rem,calc(100dvh-16rem))] min-h-20"}
          composer={
            statusChange ? (
              <div className="m-2 flex flex-col gap-2 rounded-xl border border-accent/50 bg-accent-soft/40 p-3">
                <TextAreaField label={statusChange.label} required rows={3} value={statusChange.value} onChange={statusChange.onChange} placeholder="What did you do? Add a note about this status change" />
                <div className="flex gap-2">
                  <button type="button" onClick={statusChange.onSubmit} disabled={!statusChange.value.trim() || statusChange.busy} className="btn-brand h-9 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">
                    {statusChange.busy ? "Saving…" : statusChange.submitLabel}
                  </button>
                  <button type="button" onClick={statusChange.onCancel} className="h-9 rounded-xl border border-border px-4 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
                </div>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
