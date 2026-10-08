"use client";

import { useState } from "react";
import { Field, SelectField, controlClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { useBacklog } from "../context/BacklogContext";
import { groupOwnersByRole } from "../ownerGroups";
import CreateOwnerDrawer from "./CreateOwnerDrawer";

const NEW_OWNER = "__new-owner__";

type OwnerSelectProps = {
  value: string;
  onChange: (owner: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Field label (default "Owner"). */
  label?: string;
  /** Hides the built-in "Unassigned" option. */
  excludeUnassigned?: boolean;
  /**
   * Shows only names, grouped under role headers, and offers "+ Add New Role or Position",
   * which opens a side panel (Name, Role / Position, Team) instead of the inline name input.
   */
  groupByRole?: boolean;
};

/** Owner dropdown that can create a new owner in place. */
export default function OwnerSelect({ value, onChange, required, placeholder, label = "Owner", excludeUnassigned = false, groupByRole = false }: OwnerSelectProps) {
  const { owners, ownerRecords, addOwner } = useBacklog();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (saving) return;
    const existing = owners.some((o) => o.toLowerCase() === name.trim().toLowerCase());
    setSaving(true);
    const created = await addOwner(name);
    setSaving(false);
    if (!created) return;
    onChange(created);
    toast.show(existing ? `${created} already exists, selected` : `Owner ${created} added`, existing ? "info" : "success");
    setAdding(false);
    setName("");
  }

  function cancel() {
    setAdding(false);
    setName("");
  }

  const visible = ownerRecords.filter((o) => !excludeUnassigned || o.name !== "Unassigned");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SelectField
        label={label}
        required={required}
        // The panel path keeps the current selection; the inline path shows the "add" option while typing.
        value={adding ? NEW_OWNER : value}
        onChange={(v) => {
          if (v !== NEW_OWNER) return setAdding(false), onChange(v);
          if (groupByRole) setPanelOpen(true);
          else setAdding(true);
        }}
        groups={groupByRole ? groupOwnersByRole(visible) : undefined}
        options={[
          ...(groupByRole ? [] : visible.map((o) => o.name)),
          { value: NEW_OWNER, label: groupByRole ? "+ Add New Role or Position" : "+ Add New Owner" },
        ]}
        placeholder={placeholder}
      />
      {adding && (
        <div className="anim-fade-up flex flex-col gap-2">
          <Field label="New owner name" required>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
              placeholder="Enter owner name"
              className={`${controlClass} h-10`}
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={!name.trim() || saving}
              className="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {saving ? "Adding…" : "Add owner"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {panelOpen && (
        <CreateOwnerDrawer
          heading="Add New Role or Position"
          submitLabel="Add"
          requireRole
          onClose={() => setPanelOpen(false)}
          onCreated={onChange}
        />
      )}
    </div>
  );
}
