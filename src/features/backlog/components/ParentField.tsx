"use client";

import { SelectField } from "@/components/ui/FormControls";
import type { ItemType } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { hasParentField, isTicket, parentChoices, parentLabel } from "../hierarchy";

/** The parent of a Bug (a top-level task, optional) or a Ticket (a task or a Bug, required). Shown only for those two types. */
export default function ParentField({ type, value, onChange, selfId, className }: { type: ItemType | "" | undefined; value: string; onChange: (code: string) => void; selfId?: string; className?: string }) {
  const { items } = useBacklog();
  const t = type || undefined;
  if (!hasParentField(t)) return null;
  const options = parentChoices(t, items, selfId).map((i) => ({ value: i.id, label: `${i.id} · ${i.title}` }));
  return (
    <SelectField
      className={className}
      label={parentLabel()}
      required={isTicket(t)}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={isTicket(t) ? "Choose the task it belongs to" : "No parent"}
    />
  );
}
