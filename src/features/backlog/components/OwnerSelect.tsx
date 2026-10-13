"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { SelectField } from "@/components/ui/FormControls";
import { PlusIcon } from "@/components/ui/icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import CreateOwnerDrawer from "./CreateOwnerDrawer";
import { useBacklog } from "../context/BacklogContext";

type OwnerSelectProps = {
  value: string;
  onChange: (owner: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Field label (default "Owner"). */
  label?: string;
  /** Hides the built-in "Unassigned" option. */
  excludeUnassigned?: boolean;
};

/**
 * Owner picker. Owners are their own records (not users): type to search their names and pick one. "Add Owner" opens the
 * Create owner form (Admins), and the new owner is selected once saved.
 */
export default function OwnerSelect({ value, onChange, required, placeholder, label = "Owner", excludeUnassigned = false }: OwnerSelectProps) {
  const { ownerRecords } = useBacklog();
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);

  const options = ownerRecords.filter((o) => !excludeUnassigned || o.name !== "Unassigned");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex w-full items-end gap-2">
        <SelectField
          className="flex-1"
          label={label}
          required={required}
          value={value}
          onChange={onChange}
          // A current owner who is not in the list (e.g. an old owner record) stays selectable so editing never blanks it.
          options={[...new Set([...(value && !options.some((o) => o.name === value) ? [value] : []), ...options.map((o) => o.name)])]}
          placeholder={placeholder ?? "Choose owner"}
        />
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <PlusIcon width={14} height={14} />
            Add Owner
          </button>
        )}
      </div>
      {/* Rendered in document.body: a <form> can't sit inside the backlog form's <form>. */}
      {adding &&
        createPortal(
        <CreateOwnerDrawer
          showRole={false}
          onClose={() => setAdding(false)}
          onCreated={(name) => onChange(name)}
        />,
        document.body,
      )}
    </div>
  );
}
