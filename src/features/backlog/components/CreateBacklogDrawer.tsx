"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { ITEM_TYPES, PRIORITIES } from "@/constants/backlog-options";
import type { ItemType, Priority } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { formatDeadline, todayISO } from "../utils";
import AssigneeField, { cleanAssignees } from "./AssigneeField";
import BacklogDrawer from "./BacklogDrawer";
import LeadSelect from "./LeadSelect";
import OwnerSelect from "./OwnerSelect";
import TaskPlacementFields, { emptyPlacement, placementToItem, type Placement } from "./TaskPlacementFields";

function CreateForm() {
  const { nextId, addItem, closeCreate } = useBacklog();
  const toast = useToast();
  const [created] = useState(todayISO);
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ItemType | "">("");
  const [priority, setPriority] = useState<Priority>("Not set");
  const [deadline, setDeadline] = useState("");
  const [placement, setPlacement] = useState<Placement>(emptyPlacement);
  const [lead, setLead] = useState("");
  const [assignees, setAssignees] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
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
      assignees: cleanAssignees(assignees, lead),
      notes,
      created,
      activity: [{ date: created, text: "Created" }],
    });
    if (!saved) return false;
    toast.show(`Created ${saved.id}`);
  }

  const metaItem = (label: string, value: string) => (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );

  return (
    <BacklogDrawer heading="Create backlog" submitLabel="Create backlog" onSubmit={submit} onClose={closeCreate}>
      <dl className="flex gap-6 rounded-xl border border-border bg-background px-4 py-3">
        {metaItem("Task ID", nextId)}
        {metaItem("Created", formatDeadline(created))}
        {metaItem("Status", "Backlog")}
      </dl>

      <OwnerSelect required excludeUnassigned value={owner} onChange={setOwner} placeholder="Choose owner" />
      <TextField label="Title" required value={title} onChange={setTitle} placeholder="Short name for the work" />
      <TextAreaField
        label="Description"
        rows={4}
        value={description}
        onChange={setDescription}
        placeholder="What's the problem, and what will change for users once it's done?"
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField className="order-1" label="Type" required value={type} onChange={(v) => setType(v as ItemType)} options={ITEM_TYPES} placeholder="Choose type" />
        <SelectField className="order-2" label="Priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={["Not set", ...PRIORITIES.filter((p) => p !== "Not set")]} />
        <TextField className="order-3" label="Expected deadline" type="date" value={deadline} onChange={setDeadline} />
        <TaskPlacementFields value={placement} onChange={setPlacement} createLayout />
        <LeadSelect
          className="order-5"
          value={lead}
          onChange={(v) => {
            setLead(v);
            // The Lead can't also be an assignee.
            setAssignees((a) => cleanAssignees(a, v));
          }}
        />
      </div>

      <AssigneeField value={assignees} onChange={setAssignees} exclude={lead} placeholder="Optional. Add later when you plan it." />
      <TextAreaField label="Notes" value={notes} onChange={setNotes} />
    </BacklogDrawer>
  );
}

/** Mounted once in the dashboard layout; opened via `openCreate()` from any Create backlog button. */
export default function CreateBacklogDrawer() {
  const { createOpen } = useBacklog();
  return createOpen ? <CreateForm /> : null;
}
