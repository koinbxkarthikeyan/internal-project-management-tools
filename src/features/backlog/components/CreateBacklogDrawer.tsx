"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { useToast } from "@/components/ui/Toast";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { ITEM_TYPES, PRIORITIES } from "@/constants/backlog-options";
import type { ItemType, Priority } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { DUPLICATE_TASK_MESSAGE, taskNameTaken } from "../taskNames";
import { formatDeadline, todayISO } from "../utils";
import AssigneeField, { cleanAssignees } from "./AssigneeField";
import BacklogDrawer from "./BacklogDrawer";
import LeadSelect from "./LeadSelect";
import FormSection from "./FormSection";
import OwnerSelect from "./OwnerSelect";
import TaskPlacementFields, { emptyPlacement, placementToItem, type Placement } from "./TaskPlacementFields";

function CreateForm() {
  const { addItem, closeCreate, items, hiddenItems } = useBacklog();
  const toast = useToast();
  const [created] = useState(todayISO);
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ItemType | "">("");
  const [priority, setPriority] = useState<Priority>("Not set");
  const [deadline, setDeadline] = useState("");
  const [placement, setPlacement] = useState<Placement>(emptyPlacement);
  const [lead, setLead] = useState("");
  const [assignees, setAssignees] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    // Checked again here, just before saving, against every task now loaded (Backlog and every sprint, hidden tasks too). Nothing existing is touched.
    if (taskNameTaken(title, [...items, ...hiddenItems])) {
      setTitleError(DUPLICATE_TASK_MESSAGE);
      return false;
    }
    const { sprint, podId } = placementToItem(placement);
    const saved = await addItem({
      title: title.trim(),
      owner,
      priority,
      ...(type ? { type } : {}),
      status: "Open",
      sprint,
      podId,
      deadline,
      comments: 0,
      description,
      ...(lead ? { lead } : {}),
      assignees: cleanAssignees(assignees),
      notes,
      created,
      activity: [{ date: created, text: "Created" }],
    });
    if (!saved) return false;
    toast.show(`Created ${saved.title}`);
  }

  const metaItem = (label: string, value: string) => (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );

  return (
    <BacklogDrawer side heading="Create backlog" subtitle="Add a task to the backlog or to a sprint." mode="Create" submitLabel="Create backlog" onSubmit={submit} onClose={closeCreate}>
      <dl className="flex gap-6 rounded-xl border border-border bg-background px-4 py-3">
        {metaItem("Created", formatDeadline(created))}
        {metaItem("Status", "To Do")}
      </dl>

      <FormSection title="Basics" hint="What the work is and who it belongs to.">
        <OwnerSelect required excludeUnassigned value={owner} onChange={setOwner} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <TextField label="Title" required value={title} onChange={(v) => (setTitle(v), setTitleError(""))} placeholder="Short name for the work" />
          {titleError && <FieldError>{titleError}</FieldError>}
        </div>
        <div className="sm:col-span-2">
          <TextAreaField
            label="Description"
            rows={4}
            value={description}
            onChange={setDescription}
            placeholder="What's the problem, and what will change for users once it's done?"
          />
        </div>
      </FormSection>

      <FormSection title="Classification">
        <SelectField label="Type" required value={type} onChange={(v) => setType(v as ItemType)} options={ITEM_TYPES} placeholder="Choose type" />
        <SelectField label="Priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={["Not set", ...PRIORITIES.filter((p) => p !== "Not set")]} />
      </FormSection>

      <FormSection title="Planning" hint="When it should be done and in which sprint.">
        <TextField className="order-3" label="Expected ETA" type="date" value={deadline} onChange={setDeadline} />
        <TaskPlacementFields value={placement} onChange={setPlacement} createLayout />
      </FormSection>

      <FormSection title="People">
        <LeadSelect value={lead} onChange={setLead} />
        <AssigneeField value={assignees} onChange={setAssignees} />
      </FormSection>

      <FormSection title="Notes">
        <div className="sm:col-span-2">
          <TextAreaField label="Notes" value={notes} onChange={setNotes} placeholder="Anything else the team should know." />
        </div>
      </FormSection>
    </BacklogDrawer>
  );
}

/** Mounted once in the dashboard layout; opened via `openCreate()` from any Create backlog button. */
export default function CreateBacklogDrawer() {
  const { createOpen } = useBacklog();
  return createOpen ? <CreateForm /> : null;
}
