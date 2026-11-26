"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { useToast } from "@/components/ui/Toast";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { ITEM_TYPES, PRIORITIES } from "@/constants/backlog-options";
import type { ItemType, Priority } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { hasParentField, isTicket } from "../hierarchy";
import { DUPLICATE_TASK_MESSAGE, taskNameTaken } from "../taskNames";
import { formatDeadline, todayISO } from "../utils";
import AssigneeField, { cleanAssignees } from "./AssigneeField";
import BacklogDrawer from "./BacklogDrawer";
import LeadSelect from "./LeadSelect";
import FormSection from "./FormSection";
import OwnerSelect from "./OwnerSelect";
import ParentField from "./ParentField";
import TaskPlacementFields, { emptyPlacement, placementToItem, type Placement } from "./TaskPlacementFields";
import { EXPECTED_ETA } from "@/constants/eta";

function CreateForm() {
  const { addItem, closeCreate, items, hiddenItems } = useBacklog();
  const toast = useToast();
  const [created] = useState(todayISO);
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ItemType | "">("");
  const [parent, setParent] = useState("");
  const [parentError, setParentError] = useState("");
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
    if (isTicket(type || undefined) && !parent) {
      setParentError("A Ticket needs a parent task.");
      return false;
    }
    const { sprint, podId } = placementToItem(placement);
    const saved = await addItem({
      title: title.trim(),
      owner,
      priority,
      ...(type ? { type } : {}),
      ...(parent && hasParentField(type || undefined) ? { parent } : {}),
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
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );

  return (
    <BacklogDrawer side heading="Create backlog" subtitle="Add a task to the backlog or to a sprint." mode="Create" submitLabel="Create backlog" onSubmit={submit} onClose={closeCreate}>
      <dl className="flex gap-6 rounded-xl border border-border bg-background px-4 py-3">
        {metaItem("Created", formatDeadline(created))}
        {metaItem("Status", "To Do")}
      </dl>

      {/* Wide: two columns that fill the panel's height (the work and its long Description on the left; classification, planning, people and Notes on the right, the Notes box taking the room that is left),
          so there is no empty area and no scrolling. Narrow: one column, in the same order. */}
      <div className="@container flex flex-1 flex-col">
        <div className="grid flex-1 items-stretch gap-4 @3xl:grid-cols-2">
          <div className="contents @3xl:flex @3xl:flex-col @3xl:gap-4">
            <FormSection className="order-1 @3xl:flex-1" gridClassName="flex-1 @sm:grid-rows-[auto_1fr]" title="Basics" hint="What the work is and who it belongs to.">
        <OwnerSelect required excludeUnassigned value={owner} onChange={setOwner} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <TextField label="Title" required value={title} onChange={(v) => (setTitle(v), setTitleError(""))} placeholder="Short name for the work" />
          {titleError && <FieldError>{titleError}</FieldError>}
        </div>
        <div className="@sm:col-span-2 flex flex-col">
          <TextAreaField
            grow
            label="Description"
            rows={4}
            value={description}
            onChange={setDescription}
            placeholder="What's the problem, and what will change for users once it's done?"
          />
        </div>
      </FormSection>
          </div>
          <div className="contents @3xl:flex @3xl:flex-col @3xl:gap-4">
            <FormSection className="order-2" title="Classification">
        <SelectField label="Type" required value={type} onChange={(v) => (setType(v as ItemType), setParent(""), setParentError(""))} options={ITEM_TYPES} placeholder="Choose type" />
        <ParentField type={type} value={parent} onChange={(v) => (setParent(v), setParentError(""))} />
        <SelectField label="Priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={["Not set", ...PRIORITIES.filter((p) => p !== "Not set")]} />
      </FormSection>
            <FormSection className="order-3" title="Planning" hint="When it should be done and in which sprint.">
        <TextField className="order-3" label={EXPECTED_ETA} type="date" value={deadline} onChange={setDeadline} />
        <TaskPlacementFields value={placement} onChange={setPlacement} createLayout />
      </FormSection>
            {parentError && <div className="order-3"><FieldError>{parentError}</FieldError></div>}
            <FormSection className="order-4" title="People">
        <LeadSelect value={lead} onChange={setLead} />
        <AssigneeField value={assignees} onChange={setAssignees} />
      </FormSection>
            <FormSection className="order-5 @3xl:flex-1" gridClassName="flex-1" title="Notes">
        <div className="@sm:col-span-2 flex flex-col">
          <TextAreaField grow label="Notes" value={notes} onChange={setNotes} placeholder="Anything else the team should know." />
        </div>
      </FormSection>
          </div>
        </div>
      </div>
    </BacklogDrawer>
  );
}

/** Mounted once in the dashboard layout; opened via `openCreate()` from any Create backlog button. */
export default function CreateBacklogDrawer() {
  const { createOpen } = useBacklog();
  return createOpen ? <CreateForm /> : null;
}
