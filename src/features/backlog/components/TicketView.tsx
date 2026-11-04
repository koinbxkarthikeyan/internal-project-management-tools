"use client";

import { useCallback, useEffect, useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { SelectField, TextAreaField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { PRIORITIES, sprintLabel, statusLabel } from "@/constants/backlog-options";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TaskComments from "@/features/comments/TaskComments";
import { useUsers } from "@/features/users/hooks/useUsers";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Priority, Status } from "@/types/backlog";
import { statusOptionsFor } from "../statusOptions";
import { refreshTicketViews } from "../ticketRefresh";
import { formatDeadline } from "../utils";
import { ActivityList, whenOrUnavailable } from "./ActivityTimeline";
import ReopenDialog, { canReopenItem } from "./ReopenDialog";
import TicketAttachments from "./TicketAttachments";

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 py-2 text-sm">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * A Ticket as a full page, laid out like ClickUp's task view: the main column has the Ticket id and its task, the title with its actions (Edit, then Save and Cancel;
 * Reopen), a grid of properties (status, assignee, team, priority, due date, who made it and when), the description and the images; the activity column beside it holds
 * the conversation (chat-style comments with @mentions and images) and the Activity history. The assignee and priority change at once, the status asks for its comment,
 * and the title and description wait for Save; what is typed stays while switching between Comments and Activity.
 */
export default function TicketView({ ticket: first, task, initialStatus }: { ticket: BacklogItemData; task: BacklogItemData; /** A status already chosen (a card dropped on a column): it waits for its comment and Save status. */ initialStatus?: Status }) {
  const toast = useToast();
  const users = useUsers();
  const { user, isQa, isAdmin, isSuperAdmin } = useAuth();
  const [ticket, setTicket] = useState<BacklogItemData>(first);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const [reopening, setReopening] = useState(false);
  const [commentsVersion, setCommentsVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(first.title);
  const [description, setDescription] = useState(first.description ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(initialStatus ?? first.status);
  const [comment, setComment] = useState("");
  const [changing, setChanging] = useState(false);

  const apply = useCallback((t: BacklogItemData) => {
    setTicket(t);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setStatus(t.status);
    setComment("");
    setEditing(false);
  }, []);
  const load = useCallback(() => {
    if (first.apiId == null) return;
    backlogService.getItemByApiId(first.apiId).then(
      (t) => (apply(t), initialStatus && initialStatus !== t.status && setStatus(initialStatus), setError("")),
      (err) => setError(getErrorMessage(err)),
    );
  }, [first.apiId, apply, initialStatus]);
  useEffect(load, [load]);

  const mine = !!user && (ticket.assigneeIds ?? []).includes(user.id);
  // Only QA, the admins, the Ticket's assignee and the person who created it work on it (the creator may finish it): being the task's Lead or an Assigned User gives no say over other people's Tickets.
  const creator = !!user && ticket.createdById === user.id;
  const canEdit = isQa || isAdmin || mine || creator;
  const dirty = title.trim() !== ticket.title || description !== (ticket.description ?? "");
  // Something was saved: My Task and the notifications read the Tickets again.
  const changed = () => user && refreshTicketViews(user.id);

  async function save() {
    if (!title.trim()) return toast.show("Enter a title for the Ticket.", "danger");
    setSaving(true);
    try {
      const saved = await backlogService.updateTicket(ticket.id, { title: title.trim(), description, priority: ticket.priority, assignee: ticket.assignees ?? "" });
      apply(saved);
      changed();
      toast.show(`${saved.title} updated`);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  }

  /** Assign or re-prioritise at once, leaving whatever is being typed in the title and description alone. */
  async function quick(patch: { priority?: Priority; assignee?: string }, done: string) {
    try {
      const saved = await backlogService.updateTicket(ticket.id, { title: ticket.title, description: ticket.description ?? "", priority: patch.priority ?? ticket.priority, assignee: patch.assignee ?? ticket.assignees ?? "" });
      setTicket(saved);
      changed();
      toast.show(done);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
    }
  }

  async function moveTo() {
    if (!comment.trim()) return;
    setChanging(true);
    try {
      const note = comment.trim();
      apply(await backlogService.changeStatusWithDetails(ticket.id, status, note));
      // The data layer also records the note as a comment, so it shows in the conversation as well as in the Activity.
      setCommentsVersion((v) => v + 1);
      changed();
      toast.show(`${ticket.title} is now ${status}`);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
    } finally {
      setChanging(false);
    }
  }

  const options = statusOptionsFor(ticket, isAdmin, isAdmin || isQa, creator);
  const reopens = (ticket.activity ?? []).filter((a) => a.reopen).sort((a, b) => Date.parse(b.reopen?.at ?? "") - Date.parse(a.reopen?.at ?? ""));
  const tabClass = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`;
  const btn = "h-8 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div aria-label={`Ticket ${ticket.id}`} className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,30rem)] xl:items-start">
      <article className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
        <header className="flex flex-col gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="shrink-0 rounded-md bg-hover px-2 py-0.5 font-mono text-xs font-semibold text-foreground">{ticket.id}</span>
            <span className="truncate">in <span className="font-mono">{task.id}</span> {task.title}</span>
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-72">
              {editing ? (
                <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-2xl font-semibold focus-visible:border-accent focus-visible:outline-none!" />
              ) : (
                <h1 className="break-words text-2xl font-semibold">{ticket.title}</h1>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(creator || isSuperAdmin) && !editing && <button type="button" onClick={() => setEditing(true)} className={`${btn} border border-border hover:bg-hover`}>Edit</button>}
              {editing && (
                <>
                  {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
                  <button type="button" onClick={() => apply(ticket)} disabled={saving} className={`${btn} border border-border hover:bg-hover`}>Cancel</button>
                  <button type="button" onClick={() => void save()} disabled={saving || !title.trim()} className={`${btn} btn-brand`}>{saving ? "Saving…" : "Save"}</button>
                </>
              )}
              {canReopenItem(ticket, task, user, isAdmin, isQa) && <button type="button" onClick={() => setReopening(true)} className={`${btn} border border-accent text-accent hover:bg-accent-soft`}>Reopen</button>}
            </div>
          </div>
        </header>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}

        <section aria-label="Properties">
          <dl className="grid gap-x-10 border-t border-border/60 sm:grid-cols-2">
            <Prop label="Status">
              <div className="flex flex-col gap-1.5">
                <SelectField label="" value={status} onChange={(v) => setStatus(v as Status)} options={options} disabled={!(isQa || isAdmin || mine || creator) || ticket.status === "Done"} disabledReason={ticket.status === "Done" ? "Use Reopen to change a completed Ticket." : "You can't change this Ticket's status."} />
                {status !== ticket.status && <span className="text-xs text-muted">Write the comment for this change in the Comments, then press Save status.</span>}
              </div>
            </Prop>
            <Prop label="Assignee">
              {canEdit ? <SelectField label="" value={ticket.assignees ?? ""} onChange={(v) => void quick({ assignee: v }, v ? `Assigned to ${v}` : "Unassigned")} options={["", ...users.map((u) => u.name)].map((n) => ({ value: n, label: n || "Unassigned" }))} /> : ticket.assignees || "Unassigned"}
            </Prop>
            <Prop label="Assigned team">{ticket.assignees ? (ticket.assignedTeam ?? "No team") : "–"}</Prop>
            <Prop label="Priority">
              {canEdit ? <SelectField label="" value={ticket.priority} onChange={(v) => void quick({ priority: v as Priority }, `Priority set to ${v}`)} options={PRIORITIES} /> : <PriorityBadge priority={ticket.priority} />}
            </Prop>
            {ticket.deadline && <Prop label="Due date">{formatDeadline(ticket.deadline)}</Prop>}
            <Prop label="Created by">{ticket.createdBy ?? "–"}{ticket.createdByTeam ? ` · ${ticket.createdByTeam}` : ""}</Prop>
            <Prop label="Created">{whenOrUnavailable(ticket.created, ticket.createdAt)}</Prop>
            <Prop label="Updated">{whenOrUnavailable(undefined, ticket.updatedAt)}</Prop>
            <Prop label="Parent task"><span className="font-mono text-xs text-muted">{task.id}</span> {task.title}</Prop>
            <Prop label="Sprint">{sprintLabel(ticket.sprint)}</Prop>
            {reopens.length > 0 && (
              <Prop label="Reopened">
                {whenOrUnavailable(undefined, reopens[0].reopen?.at)} by {reopens[0].reopen?.by}
                {reopens.length > 1 && <span className="block text-xs text-muted">{reopens.length} times in all (see Activity)</span>}
              </Prop>
            )}
          </dl>
        </section>

        <section aria-label="Description">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Description</h2>
          {editing ? (
            <div className="mt-2">
              <TextAreaField label="Description" rows={8} value={description} onChange={setDescription} placeholder="Steps to reproduce, what you expected, what happened" />
            </div>
          ) : (
            <p className="mt-1.5 whitespace-pre-line break-words text-sm">{ticket.description || <span className="text-muted">No description.</span>}</p>
          )}
        </section>

        <TicketAttachments ticketCode={ticket.id} canEdit={canEdit} />
      </article>

      <aside aria-label="Activity" className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 xl:sticky xl:top-4">
        <div role="tablist" aria-label="Comments and activity" className="flex gap-1 border-b border-border pb-1">
          <button type="button" role="tab" aria-selected={tab === "comments"} onClick={() => setTab("comments")} className={tabClass(tab === "comments")}>Comments</button>
          <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} className={tabClass(tab === "history")}>Activity</button>
        </div>
        {tab === "comments" || status !== ticket.status ? (
          <TaskComments
            taskId={ticket.id}
            reloadToken={commentsVersion}
            fill
            statusChange={
              status !== ticket.status
                ? { label: `Comment for the status change to ${statusLabel(status)}`, value: comment, onChange: setComment, submitLabel: "Save status", busy: changing, onSubmit: () => void moveTo(), onCancel: () => (setStatus(ticket.status), setComment("")) }
                : undefined
            }
          />
        ) : (
          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain">
            <ActivityList entries={ticket.activity} />
          </div>
        )}
      </aside>

      {reopening && <ReopenDialog item={ticket} onClose={() => setReopening(false)} onReopened={(t) => (apply(t), setCommentsVersion((v) => v + 1), changed())} />}
    </div>
  );
}
