"use client";

import { useEffect, useRef, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormControls";
import { FieldError } from "@/components/ui/FieldError";
import { ITEM_TYPES, PRIORITIES, STATUS_OPTIONS, statusLabel } from "@/constants/backlog-options";
import { getErrorMessage } from "@/lib/apiClient";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import type { BacklogItemData, ItemType, Priority, Status } from "@/types/backlog";
import { todayISO } from "../utils";
import ActivityTimeline from "./ActivityTimeline";
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

const norm = (v: unknown) => (v == null ? "" : String(v).trim());

/** Does the form (fields, placement, assignees) differ from the saved task `base`? */
function differs(draft: BacklogItemData, placement: Placement, base: BacklogItemData): boolean {
  const placed = placementToItem(placement, { sprint: base.sprint, podId: base.podId });
  const needsReason = draft.status === "Blocked" || draft.status === "On hold";
  return (
    (["title", "description", "status", "type", "priority", "deadline", "owner", "lead", "leadDeadline", "notes", "created", "completed"] as const).some((k) => norm(draft[k]) !== norm(base[k])) ||
    placed.sprint !== base.sprint ||
    norm(placed.podId) !== norm(base.podId) ||
    cleanAssignees(draft.assignees ?? "") !== cleanAssignees(base.assignees ?? "") ||
    (needsReason && norm(draft.blockedReason) !== norm(base.blockedReason))
  );
}

export default function EditBacklogDrawer({ item, onSave, onClose }: EditBacklogDrawerProps) {
  // `base` is the saved task the form is compared with: the list's copy at first, then the latest details read from the API.
  const [base, setBase] = useState<BacklogItemData>(item);
  const [draft, setDraft] = useState<BacklogItemData>(item);
  const [placement, setPlacement] = useState<Placement>(() => placementFromItem(item));
  const [detailError, setDetailError] = useState("");
  const latest = useRef({ draft, placement, base });
  useEffect(() => {
    latest.current = { draft, placement, base };
  });

  // The same read as the task panel on My Task (`GET /items/:id`, shared and cached by the item detail store): the task's fields and its
  // activity as the server has them now. The form is refilled only if nothing has been edited yet, so typing is never overwritten.
  useEffect(() => {
    let cancelled = false;
    useItemDetailStore.getState().get(item.id).then(
      (d) => {
        if (cancelled) return;
        const cur = latest.current;
        const untouched = !differs(cur.draft, cur.placement, cur.base);
        setBase(d);
        if (untouched) {
          setDraft(d);
          setPlacement(placementFromItem(d));
        }
      },
      (err) => !cancelled && setDetailError(getErrorMessage(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [item.id]);
  const set = <K extends keyof BacklogItemData>(key: K, value: BacklogItemData[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // On an unplanned task, finishing it is offered as "Close Task" (the Completed status); it then moves to Closed Unplanned Tasks.
  const statusOptions =
    base.sprint === "Unplanned" && base.status !== "Completed"
      ? STATUS_OPTIONS.map((o) => (o.value === "Completed" ? { ...o, label: "Close Task" } : o))
      : STATUS_OPTIONS;
  const needsReason = draft.status === "Blocked" || draft.status === "On hold";
  const reason = draft.blockedReason ?? "";

  // Save stays off until something differs from the saved task (changing a value back turns it off again).
  const changedFields = differs(draft, placement, base);

  function submit() {
    const { sprint, podId } = placementToItem(placement, { sprint: base.sprint, podId: base.podId });
    const next: BacklogItemData = { ...draft, sprint, podId: podId || undefined };
    const changed = TRACKED.filter(([k]) => next[k] !== base[k]).map(([, label]) => label);
    return onSave({
      ...next,
      title: draft.title.trim() || base.title,
      assignees: cleanAssignees(draft.assignees ?? ""),
      activity: changed.length
        ? [...(draft.activity ?? []), { date: todayISO(), text: `Updated ${changed.join(", ")}` }]
        : draft.activity,
    });
  }

  return (
    <BacklogDrawer
      heading={
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          {base.title}
          <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
          {statusLabel(base.status)}
        </span>
      }
      submitLabel="Save changes"
      canSubmit={changedFields}
      onSubmit={submit}
      onClose={onClose}
    >
      {detailError && <FieldError>Couldn&apos;t load the latest details ({detailError}). What you see may be out of date.</FieldError>}
      {/* Full width on its own row, like in Create backlog (not squeezed into the three-column grid below). */}
      <OwnerSelect value={draft.owner} onChange={(v) => set("owner", v)} placeholder="Search or select an owner, or add a new owner." />
      <TextField label="Title" required value={draft.title} onChange={(v) => set("title", v)} />
      <TextAreaField label="Description" rows={5} value={draft.description ?? ""} onChange={(v) => set("description", v)} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <SelectField label="Status" value={draft.status} onChange={(v) => set("status", v as Status)} options={statusOptions} />
        <SelectField label="Type" value={draft.type ?? ""} onChange={(v) => set("type", v as ItemType)} options={ITEM_TYPES} placeholder="Choose type" />
        <TaskPlacementFields value={placement} onChange={setPlacement} current={{ sprint: base.sprint, podId: base.podId }} />
        <SelectField label="Priority" value={draft.priority} onChange={(v) => set("priority", v as Priority)} options={PRIORITIES} />
        <TextField label="Expected deadline" type="date" value={draft.deadline} onChange={(v) => set("deadline", v)} />
        <LeadSelect value={draft.lead ?? ""} onChange={(v) => setDraft((d) => ({ ...d, lead: v, ...(v !== (d.lead ?? "") ? { leadDeadline: "" } : {}) }))} />
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

      <AssigneeField value={draft.assignees ?? ""} onChange={(v) => set("assignees", v)} />
      <TextAreaField label="Notes" value={draft.notes ?? ""} onChange={(v) => set("notes", v)} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <TextField label="Created" type="date" value={draft.created ?? ""} onChange={(v) => set("created", v)} />
        <TextField label="Completed" type="date" value={draft.completed ?? ""} onChange={(v) => set("completed", v)} />
      </div>

      <div className="border-t border-border pt-3">
        <ActivityTimeline compact item={base} activity={base.activity} />
      </div>
    </BacklogDrawer>
  );
}
