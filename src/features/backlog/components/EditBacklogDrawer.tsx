"use client";

import { useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { ITEM_TYPES, PRIORITIES, STATUSES } from "@/constants/backlog-options";
import type { BacklogItemData, ItemType, Priority, Status } from "@/types/backlog";
import { formatShortDate, todayISO } from "../utils";
import AssigneeField, { cleanAssignees } from "./AssigneeField";
import BacklogDrawer from "./BacklogDrawer";
import LeadSelect from "./LeadSelect";
import OwnerSelect from "./OwnerSelect";
import TaskPlacementFields, { placementFromItem, placementToItem, type Placement } from "./TaskPlacementFields";

type EditBacklogDrawerProps = {
  item: BacklogItemData;
  onSave: (item: BacklogItemData) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
};

const TRACKED: [keyof BacklogItemData, string][] = [
  ["title", "title"],
  ["status", "status"],
  ["sprint", "sprint"],
  ["podId", "POD"],
  ["priority", "priority"],
  ["deadline", "deadline"],
  ["owner", "owner"],
  ["lead", "lead"],
  ["leadDeadline", "lead deadline"],
];

export default function EditBacklogDrawer({ item, onSave, onClose }: EditBacklogDrawerProps) {
  const [draft, setDraft] = useState<BacklogItemData>(item);
  const [placement, setPlacement] = useState<Placement>(() => placementFromItem(item));
  const set = <K extends keyof BacklogItemData>(key: K, value: BacklogItemData[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const needsReason = draft.status === "Blocked" || draft.status === "On hold";
  const reason = draft.blockedReason ?? "";

  function submit() {
    const { sprint, podId } = placementToItem(placement, { sprint: item.sprint, podId: item.podId });
    const next: BacklogItemData = { ...draft, sprint, podId: podId || undefined };
    const changed = TRACKED.filter(([k]) => next[k] !== item[k]).map(([, label]) => label);
    return onSave({
      ...next,
      title: draft.title.trim() || item.title,
      assignees: cleanAssignees(draft.assignees ?? "", draft.lead),
      activity: changed.length
        ? [...(draft.activity ?? []), { date: todayISO(), text: `Updated ${changed.join(", ")}` }]
        : draft.activity,
    });
  }

  return (
    <BacklogDrawer
      heading={
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          {item.id}
          <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
          {item.status}
        </span>
      }
      submitLabel="Save changes"
      onSubmit={submit}
      onClose={onClose}
    >
      <TextField label="Title" required value={draft.title} onChange={(v) => set("title", v)} />
      <TextAreaField label="Description" rows={5} value={draft.description ?? ""} onChange={(v) => set("description", v)} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <SelectField label="Status" value={draft.status} onChange={(v) => set("status", v as Status)} options={STATUSES} />
        <SelectField label="Type" value={draft.type ?? ""} onChange={(v) => set("type", v as ItemType)} options={ITEM_TYPES} placeholder="Choose type" />
        <TaskPlacementFields value={placement} onChange={setPlacement} current={{ sprint: item.sprint, podId: item.podId }} />
        <SelectField label="Priority" value={draft.priority} onChange={(v) => set("priority", v as Priority)} options={PRIORITIES} />
        <TextField label="Expected deadline" type="date" value={draft.deadline} onChange={(v) => set("deadline", v)} />
        <LeadSelect value={draft.lead ?? ""} onChange={(v) => setDraft((d) => ({ ...d, lead: v, assignees: cleanAssignees(d.assignees ?? "", v), ...(v !== (d.lead ?? "") ? { leadDeadline: "" } : {}) }))} />
        {/* Set by the Lead from My Task; shown here (read-only) only once it has been set. */}
        {draft.leadDeadline && <TextField label="Lead Deadline" type="date" disabled value={draft.leadDeadline} onChange={() => {}} />}
        <OwnerSelect value={draft.owner} onChange={(v) => set("owner", v)} placeholder="Choose owner" />
      </div>

      {needsReason && (
        <TextAreaField
          label="Why is it blocked or on hold?"
          required
          invalid={!reason.trim()}
          value={reason}
          onChange={(v) => set("blockedReason", v)}
          placeholder="What's it waiting on, and who can unblock it?"
        />
      )}

      <AssigneeField value={draft.assignees ?? ""} onChange={(v) => set("assignees", v)} exclude={draft.lead} />
      <TextAreaField label="Notes" value={draft.notes ?? ""} onChange={(v) => set("notes", v)} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <TextField label="Created" type="date" value={draft.created ?? ""} onChange={(v) => set("created", v)} />
        <TextField label="Completed" type="date" value={draft.completed ?? ""} onChange={(v) => set("completed", v)} />
      </div>

      <section aria-label="Activity" className="border-t border-border pt-3">
        <h3 className="text-xs font-semibold">Activity</h3>
        {draft.activity?.length ? (
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
            {draft.activity.map((a, i) => (
              <li key={i}>
                {formatShortDate(a.date)}: {a.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">No activity yet.</p>
        )}
      </section>
    </BacklogDrawer>
  );
}
