"use client";
import { useState } from "react";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { PRIORITIES } from "@/constants/backlog-options";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUsers } from "@/features/users/hooks/useUsers";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Priority, Status } from "@/types/backlog";
import * as attachmentService from "@/services/attachmentService";
import type { OptimizedImage } from "@/services/attachmentService";
import CommentBox, { EMPTY_DRAFT, mentionedIn, type CommentDraft } from "@/features/comments/CommentBox";

/** The state and saving of the new-Ticket form, shared by the slide-over (Create Ticket in the Tickets block) and the panel in the task's comment section. */
export function useTicketForm(task: BacklogItemData, onCreated: (ticket: BacklogItemData) => void) {
  const toast = useToast();
  const users = useUsers();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("Not set");
  const [assignee, setAssignee] = useState("");
  const assigneeTeam = users.find((u) => u.name === assignee)?.team;
  // The description takes @mentions and images (previewed, removable), like a message.
  const [desc, setDesc] = useState<CommentDraft>(EMPTY_DRAFT);
  const [status, setStatus] = useState<Status>("Open");
  const images: OptimizedImage[] = desc.images;
  const mentioned = mentionedIn(desc);

  async function submit() {
    try {
      const ticket = await backlogService.createTicket(task.id, { title: title.trim(), priority, ...(assignee ? { assignee } : {}), ...(desc.text.trim() ? { description: desc.text } : {}), status, ...(mentioned.length ? { mentionIds: mentioned.map((m) => m.id) } : {}) });
      // The Ticket exists now; its images are saved as attachments linked to it. If they can't be saved the Ticket is kept and the person is told.
      if (images.length) {
        try {
          await attachmentService.addAttachments(ticket.id, images);
        } catch (err) {
          toast.show(`Created ${ticket.title}, but its images couldn't be saved: ${getErrorMessage(err)}`, "warning");
          onCreated(ticket);
          return;
        }
      }
      toast.show(images.length ? `Created ${ticket.title} with ${images.length} ${images.length === 1 ? "image" : "images"}` : `Created ${ticket.title}`);
      onCreated(ticket);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
      return false;
    }
  }
  return { title, setTitle, priority, setPriority, assignee, setAssignee, assigneeTeam, desc, setDesc, status, setStatus, submit, canSubmit: !!title.trim() };
}

/** The fields of the new-Ticket form: Title, Description (@mentions, images), Priority, Assignee and Status. `compact` leaves out the Task / Created by summary. */
export function TicketFormFields({ task, form, compact = false }: { task: BacklogItemData; form: ReturnType<typeof useTicketForm>; compact?: boolean }) {
  const users = useUsers();
  const { user } = useAuth();
  const { title, setTitle, priority, setPriority, assignee, setAssignee, assigneeTeam, desc, setDesc, status, setStatus } = form;
  return (
    <>
      {!compact && (
        <dl className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
          <dt className="text-[11px] text-muted">Task</dt>
          <dd className="mt-0.5 font-semibold">{task.id} · {task.title}</dd>
          {/* Taken from the signed-in profile when the Ticket is saved: nobody types their own name or team. */}
          <dt className="mt-2 text-[11px] text-muted">Created by</dt>
          <dd className="mt-0.5">{user?.name ?? "–"} · {user?.team || "No team"}</dd>
        </dl>
      )}
      <TextField label="Title" required value={title} onChange={setTitle} placeholder="What needs fixing or checking?" />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Description</span>
        <CommentBox bare label="Description" draft={desc} onChange={setDesc} onSend={() => {}} canSend={false} rows={compact ? 3 : 4} placeholder="Steps to reproduce, what you expected, what happened. Type @ to mention someone." />
      </div>
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-3" : "grid-cols-2"}`}>
        <SelectField label="Priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={["Not set", ...PRIORITIES.filter((p) => p !== "Not set")]} />
        <SelectField label="Assignee" value={assignee} onChange={setAssignee} options={users.map((u) => u.name)} placeholder="Unassigned" />
        <SelectField label="Status" value={status} onChange={(v) => setStatus(v as Status)} options={[{ value: "Open", label: "To Do" }, { value: "In progress", label: "In Progress" }, { value: "Testing", label: "Testing" }]} />
      </div>
      {assignee && <p className="text-xs text-muted">Assigned team: {assigneeTeam || "No team"} (the assignee&apos;s own team, separate from yours)</p>}
    </>
  );
}
