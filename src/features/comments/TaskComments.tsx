"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { TextAreaField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getErrorMessage } from "@/lib/apiClient";
import * as attachmentService from "@/services/attachmentService";
import * as commentService from "@/services/commentService";
import type { TaskComment } from "@/services/commentService";
import Avatar from "./Avatar";
import CommentBox, { CommentText, EMPTY_DRAFT, mentionedIn, type CommentDraft } from "./CommentBox";
import CommentImages from "./CommentImages";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

/** When a status is being changed, the comment that goes with the change is typed in this section (it also becomes a comment in the list once saved). */
export type StatusChangeComposer = { label: string; value: string; onChange: (v: string) => void; submitLabel: string; busy: boolean; onSubmit: () => void; onCancel: () => void };

/** The last comment this person has seen on a task, kept in this browser: what is newer (and from someone else) is marked as new. */
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
 * The conversation on one task or Ticket (each has its own), chat style: avatars, the signed-in person's messages on the right and others' on the left, @mentions
 * picked out, images shown in the message and opened larger by a click, the time on every message, and the message box fixed under the conversation. Messages are kept
 * in this browser with the rest of the data; anyone who can open the task can write. Authors edit or delete their own (admins may delete). A notification link
 * (`?comment=<id>`) scrolls to that message.
 */
export default function TaskComments({ taskId, reloadToken = 0, statusChange, fill = false, onNewTicket }: { taskId: string; /** Typing + into the empty message box opens this (the new Ticket form) at once; it is never sent as a message. */ onNewTicket?: () => void; /** Let the conversation use the height of the page (the task pages) instead of a short box. */ fill?: boolean; /** Changes when the list should be read again. */ reloadToken?: number; statusChange?: StatusChangeComposer }) {
  const toast = useToast();
  const { user, isQa, isAdmin } = useAuth();
  const router = useRouter();
  const target = useSearchParams().get("comment");
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<CommentDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; draft: CommentDraft } | null>(null);
  // The first message I had not seen when this opened (the "New messages" line goes above it).
  const [firstNew, setFirstNew] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  // The Edit and Delete buttons of a message go away by themselves when its 30 minutes are over (the server enforces it too).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const open = (c: TaskComment) => !c.editableUntil || now <= Date.parse(c.editableUntil);
  const scrolled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    commentService.getComments(taskId).then(
      (rows) => {
        if (cancelled) return;
        setComments(rows);
        if (user && !scrolled.current) {
          const key = seenKey(user.id, taskId);
          const seen = readSeen(key);
          setFirstNew(seen == null ? null : (rows.find((c) => Number(c.id) > seen && c.userId !== user.id)?.id ?? null));
          try {
            if (rows.length) localStorage.setItem(key, String(Math.max(...rows.map((c) => Number(c.id)))));
          } catch {
            /* unread marks just are not kept */
          }
        }
      },
      (err) => !cancelled && (setComments([]), setError(getErrorMessage(err))),
    );
    return () => {
      cancelled = true;
    };
  }, [taskId, reloadToken, user]);

  // Show the latest message (or the one a notification pointed to) once the conversation is read, and after each send.
  const count = comments?.length ?? 0;
  useEffect(() => {
    const el = list.current;
    if (!el || comments === null) return;
    const at = !scrolled.current && target ? el.querySelector<HTMLElement>(`#comment-${CSS.escape(target)}`) : null;
    if (at) at.scrollIntoView({ block: "center" });
    else el.scrollTop = el.scrollHeight;
    scrolled.current = true;
    // Only the number of messages decides when to scroll again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, comments === null]);

  const canSend = !!draft.text.trim() || draft.images.length > 0;

  async function add() {
    if (busy || !canSend) return;
    if (onNewTicket && draft.text.trim() === "+" && draft.images.length === 0) {
      setDraft(EMPTY_DRAFT);
      return onNewTicket();
    }
    setBusy(true);
    setError("");
    try {
      const saved = await commentService.addComment(taskId, draft.text, { mentionIds: mentionedIn(draft).map((m) => m.id), withImages: draft.images.length > 0 });
      if (draft.images.length) {
        try {
          await attachmentService.addAttachments(taskId, draft.images, Number(saved.id));
        } catch (err) {
          toast.show(`The message was sent, but its images couldn't be saved: ${getErrorMessage(err)}`, "warning");
        }
      }
      setComments(await commentService.getComments(taskId));
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (busy || !editing || !editing.draft.text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const saved = await commentService.editComment(editing.id, editing.draft.text, mentionedIn(editing.draft).map((m) => m.id));
      setComments((prev) => (prev ?? []).map((c) => (c.id === saved.id ? saved : c)));
      setEditing(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await commentService.deleteComment(id);
      setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
      toast.show("Message deleted");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const newCount = firstNew && comments ? comments.filter((c) => Number(c.id) >= Number(firstNew) && c.userId !== user?.id).length : 0;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${fill ? "min-h-[min(36rem,calc(100dvh-12rem))]" : ""}`}>
      <p className="text-xs font-medium text-muted">
        Comments{comments && comments.length > 0 ? ` (${comments.length})` : ""}
        {newCount > 0 && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">{newCount} new</span>}
      </p>
      <div ref={list} role="log" aria-label="Conversation" className={`flex min-h-20 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-background/60 p-3 ${fill ? "max-h-[calc(100dvh-14rem)] flex-1" : "max-h-96"}`}>
        {comments === null ? (
          <p className="text-sm text-muted" role="status">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="m-auto text-sm text-muted">No comments yet.</p>
        ) : (
          comments.map((c) => {
            const own = c.userId === user?.id;
            const isTarget = target === c.id;
            return (
              <div key={c.id} className="flex flex-col gap-3">
                {firstNew === c.id && (
                  <div role="separator" className="flex items-center gap-2 text-[11px] font-semibold text-accent">
                    <span className="h-px flex-1 bg-accent/40" />New messages<span className="h-px flex-1 bg-accent/40" />
                  </div>
                )}
                <div id={`comment-${c.id}`} className={`flex items-end gap-2 ${own ? "flex-row-reverse" : ""}`}>
                  <Avatar name={c.by} id={c.userId} />
                  <div className={`min-w-0 max-w-[85%] rounded-2xl border px-3 py-2 ${own ? "rounded-br-sm border-accent/30 bg-accent-soft" : "rounded-bl-sm border-border bg-surface"} ${isTarget ? "ring-2 ring-accent" : ""}`}>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-muted">
                      <span className="font-semibold text-foreground">{own ? "You" : c.by}</span>
                      {c.team && <span>{c.team}</span>}
                    </p>
                    {editing?.id === c.id ? (
                      <div className="mt-1.5 flex w-72 max-w-full flex-col gap-2">
                        <CommentBox label="Edit message" images={false} draft={editing.draft} onChange={(d) => setEditing({ id: c.id, draft: d })} onSend={() => void saveEdit()} canSend={!!editing.draft.text.trim()} sending={busy} sendLabel="Save" />
                        <button type="button" onClick={() => setEditing(null)} className="w-fit text-xs font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {c.text && <p className="mt-0.5 whitespace-pre-line break-words text-sm"><CommentText text={c.text} mentions={c.mentions} /></p>}
                        {c.ticket && (
                          <button type="button" onClick={() => router.push(`${isQa || isAdmin ? READY_FOR_QA_HREF : MY_TASK_HREF}/ticket?id=${c.ticket!.id}`)} className="mt-1 inline-flex items-center rounded-md border border-accent/40 bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Open {c.ticket.code}</button>
                        )}
                        <CommentImages images={c.images} />
                      </>
                    )}
                    <p className="mt-1 flex items-center justify-end gap-3 text-[10px] text-muted">
                      {editing?.id !== c.id && c.canEdit && open(c) && <button type="button" onClick={() => setEditing({ id: c.id, draft: { text: c.text, mentions: c.mentions, images: [] } })} className="font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Edit</button>}
                      {editing?.id !== c.id && c.canDelete && (open(c) || isAdmin) && <button type="button" onClick={() => void remove(c.id)} className="font-medium text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-accent dark:text-red-300">Delete</button>}
                      <time dateTime={c.createdAt}>{when(c.createdAt)}{c.updatedAt && <span title={`Edited ${when(c.updatedAt)}`}> · edited</span>}</time>
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {statusChange ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/50 bg-accent-soft/40 p-3">
          <TextAreaField label={statusChange.label} required rows={3} value={statusChange.value} onChange={statusChange.onChange} placeholder="What did you do? Add a note about this status change" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={statusChange.onSubmit}
              disabled={!statusChange.value.trim() || statusChange.busy}
              className="btn-brand h-9 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusChange.busy ? "Saving…" : statusChange.submitLabel}
            </button>
            <button type="button" onClick={statusChange.onCancel} className="h-9 rounded-xl border border-border px-4 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
          <CommentBox label="Add a comment" draft={draft} onChange={(d) => {
            // Typing + into an empty box opens the new Ticket form at once (no Enter needed).
            if (onNewTicket && d.text === "+" && draft.text === "") return onNewTicket();
            setDraft(d);
            setError("");
          }} onSend={() => void add()} canSend={canSend} sending={busy} placeholder={onNewTicket ? "Write a message. Type @ to mention someone, or type + for a new Ticket." : "Write a message. Type @ to mention someone."} />
        </>
      )}
    </div>
  );
}
