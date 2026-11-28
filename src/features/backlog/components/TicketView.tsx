"use client";

import { SprintName } from "@/components/ui/NameWithIcon";
import SendBack from "./SendBack";
import { MESSAGES_LABEL } from "@/constants/work";
import TabSwap from "@/components/ui/TabSwap";
import AssigneeStack, { assigneePeople } from "@/components/ui/AssigneeStack";
import AssigneeField, { cleanAssignees } from "./AssigneeField";
import { useCallback, useEffect, useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { SelectField, TextAreaField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { PRIORITIES, statusLabel } from "@/constants/backlog-options";
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
    <div className="grid min-h-12 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 border-b border-border/60 py-1.5 text-sm">
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
  const { user, isQa, isAdmin } = useAuth();
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
  // The Assignees being picked (names separated by commas); saved with the Save button under the field.
  const [assignDraft, setAssignDraft] = useState(first.assignees ?? "");
  const [comment, setComment] = useState("");
  const [changing, setChanging] = useState(false);

  const apply = useCallback((t: BacklogItemData) => {
    setTicket(t);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setStatus(t.status);
    setAssignDraft(t.assignees ?? "");
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

  // Only QA, the admins, the Ticket's assignee and the person who created it work on it (the creator may finish it): being the task's Lead or an Assigned User gives no say over other people's Tickets.
  const creator = !!user && ticket.createdById === user.id;
  // Only the person who created the Ticket (and the admins) can change its Assignees, Priority and images; its assigned users can change its status. QA and everyone else see it, and
  // its comments and history, but change nothing here.
  const canEdit = isAdmin || creator;
  // The Ticket's assigned users also change its status (and only that).
  const mine = !!user && (ticket.assigneeIds ?? []).includes(user.id);
  const canSetDetails = canEdit;
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
      setAssignDraft(ticket.assignees ?? "");
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
  // Whose turn it is: with QA from Ready for QA until Done, otherwise with the people working on it. "Hand to QA" is one click for those who may set Ready for QA (QA itself needn't).
  const withQa = ticket.status === "Ready for QA" || ticket.status === "Testing";
  const canHand = (canEdit || mine) && !isQa && !withQa && ticket.status !== "Done" && options.some((o) => o.value === "Ready for QA");
  // QA (and the admins) return work that is with them: "Send back to developer" asks what needs fixing, then sets In progress.
  const canSendBack = withQa && (isQa || isAdmin);
  async function sendBack(reason: string) {
    try {
      apply(await backlogService.changeStatusWithDetails(ticket.id, "In progress", reason));
      setCommentsVersion((v) => v + 1);
      changed();
      toast.show(`${ticket.id} sent back to the developer`);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
      throw err;
    }
  }
  async function handToQa() {
    setChanging(true);
    try {
      apply(await backlogService.changeStatusWithDetails(ticket.id, "Ready for QA", "Handed to QA"));
      setCommentsVersion((v) => v + 1);
      changed();
      toast.show(`${ticket.id} handed to QA`);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
    } finally {
      setChanging(false);
    }
  }
  const reopens = (ticket.activity ?? []).filter((a) => a.reopen).sort((a, b) => Date.parse(b.reopen?.at ?? "") - Date.parse(a.reopen?.at ?? ""));
  const tabClass = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`;
  const btn = "h-8 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div aria-label={`Ticket ${ticket.id}`} className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(24rem,30rem)] 2xl:items-start">
      <article className="@container flex min-w-0 flex-col gap-5 card p-6">
        <header className="flex flex-col gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="shrink-0 rounded-md bg-hover px-2 py-0.5 font-mono text-xs font-semibold text-foreground">{ticket.id}</span>
            <span className="truncate">in <span className="font-mono">{task.id}</span> {task.title}</span>
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-72">
              {editing ? (
                <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" className="field w-full px-2.5 py-1.5 text-2xl font-semibold" />
              ) : (
                <h1 title={ticket.title} className="truncate text-2xl font-semibold">{ticket.title}</h1>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                {ticket.status !== "Done" && <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">{withQa ? "Waiting on QA" : "With the developer"}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {creator && !editing && <button type="button" onClick={() => setEditing(true)} className={`${btn} border border-border hover:bg-hover`}>Edit</button>}
              {editing && (
                <>
                  {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
                  <button type="button" onClick={() => apply(ticket)} disabled={saving} className={`${btn} border border-border hover:bg-hover`}>Cancel</button>
                  <button type="button" onClick={() => void save()} disabled={saving || !dirty || !title.trim()} title={!saving && !dirty ? "No changes to save." : undefined} className={`${btn} btn-brand disabled:cursor-not-allowed disabled:opacity-60`}>{saving ? "Saving…" : "Save"}</button>
                </>
              )}
              {canHand && <button type="button" onClick={() => void handToQa()} disabled={changing} className={`${btn} btn-brand`}>{changing ? "Handing over…" : "Hand to QA"}</button>}
              {canReopenItem(ticket, task, user, isAdmin, isQa) && <button type="button" onClick={() => setReopening(true)} className={`${btn} border border-accent text-accent hover:bg-accent-soft`}>Reopen</button>}
            </div>
          </div>
        </header>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        {canSendBack && status === ticket.status && <SendBack onSend={sendBack} />}

        <section aria-label="Properties">
          <dl className="grid gap-x-8 border-t border-border/60 @2xl:grid-cols-2">
            <Prop label="Status">
              <SelectField label="" value={status} onChange={(v) => setStatus(v as Status)} options={options} disabled={!(canEdit || mine) || ticket.status === "Done"} disabledReason={ticket.status === "Done" ? "Use Reopen to change a completed Ticket." : "You can't change this Ticket's status."} />
            </Prop>
            <Prop label="Assignee">
              {canSetDetails ? (
                // Ticking or unticking a person saves at once (no Save button).
                <AssigneeField bare value={assignDraft} onChange={setAssignDraft} onPick={(v) => void quick({ assignee: cleanAssignees(v) }, cleanAssignees(v) ? `Assigned to ${cleanAssignees(v)}` : "Unassigned")} />
              ) : (
                <AssigneeStack people={assigneePeople(ticket.assignees, users)} />
              )}
            </Prop>
            <Prop label="Assigned team">{ticket.assignees ? ([...new Set(assigneePeople(ticket.assignees, users).map((p) => p.team).filter(Boolean))].join(", ") || ticket.assignedTeam || "No team") : "–"}</Prop>
            <Prop label="Priority">
              {canSetDetails ? <SelectField label="" value={ticket.priority} onChange={(v) => void quick({ priority: v as Priority }, `Priority set to ${v}`)} options={PRIORITIES} /> : <PriorityBadge priority={ticket.priority} />}
            </Prop>
            {ticket.deadline && <Prop label="Due date">{formatDeadline(ticket.deadline)}</Prop>}
            <Prop label="Created by">{ticket.createdBy ?? "–"}{ticket.createdByTeam ? ` · ${ticket.createdByTeam}` : ""}</Prop>
            <Prop label="Created">{whenOrUnavailable(ticket.created, ticket.createdAt)}</Prop>
            <Prop label="Updated">{whenOrUnavailable(undefined, ticket.updatedAt)}</Prop>
            <Prop label="Parent task"><span className="font-mono text-xs text-muted">{task.id}</span> {task.title}</Prop>
            <Prop label="Sprint"><SprintName name={ticket.sprint} /></Prop>
            {reopens.length > 0 && (
              <Prop label="Reopened">
                {whenOrUnavailable(undefined, reopens[0].reopen?.at)} by {reopens[0].reopen?.by}
                {reopens.length > 1 && <span className="block text-xs text-muted">{reopens.length} times in all (see Activity)</span>}
              </Prop>
            )}
          </dl>
          {status !== ticket.status && <p className="mt-2 text-xs text-muted">Write the comment for this change in the {MESSAGES_LABEL}, then press Save status.</p>}
        </section>

        <section aria-label="Description" className="border-t border-border/60 pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Description</h2>
          {editing ? (
            <div className="mt-2">
              <TextAreaField label="Description" rows={8} value={description} onChange={setDescription} placeholder="Steps to reproduce, what you expected, what happened" />
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">{ticket.description || <span className="text-muted">No description.</span>}</p>
          )}
        </section>

        <TicketAttachments ticketCode={ticket.id} canEdit={canEdit} />
      </article>

      <aside aria-label="Activity" className="flex min-w-0 flex-col gap-3 card p-4 2xl:sticky 2xl:top-4 2xl:h-[calc(100dvh-6.5rem)]">
        <div role="tablist" aria-label={`${MESSAGES_LABEL} and activity`} className="flex gap-1 border-b border-border pb-1">
          <button type="button" role="tab" aria-selected={tab === "comments"} onClick={() => setTab("comments")} className={tabClass(tab === "comments")}>{MESSAGES_LABEL}</button>
          <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} className={tabClass(tab === "history")}>Activity</button>
        </div>
      <TabSwap id={tab === "comments" || status !== ticket.status ? "c" : "h"} className="flex min-h-0 min-w-0 flex-col 2xl:flex-1">
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
          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain 2xl:min-h-0 2xl:flex-1">
            <ActivityList entries={ticket.activity} />
          </div>
        )}
      </TabSwap>
      </aside>

      {reopening && <ReopenDialog item={ticket} onClose={() => setReopening(false)} onReopened={(t) => (apply(t), setCommentsVersion((v) => v + 1), changed())} />}
    </div>
  );
}
