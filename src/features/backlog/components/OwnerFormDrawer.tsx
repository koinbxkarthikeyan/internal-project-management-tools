"use client";

import { useState } from "react";
import { ComboField, TextField } from "@/components/ui/FormControls";
import { useBacklog } from "../context/BacklogContext";
import { roleSuggestions, teamSuggestions } from "../ownerGroups";
import BacklogDrawer from "./BacklogDrawer";
import { FieldError } from "@/components/ui/FieldError";

type OwnerFormDrawerProps = {
  heading: string;
  submitLabel: string;
  initialName?: string;
  initialRole?: string;
  initialTeam?: string;
  /** Makes Role / Position mandatory (used when adding a new role or position). */
  requireRole?: boolean;
  /** Shows the Role / Position field (default true). */
  showRole?: boolean;
  /** Editing an existing owner: saving is off until something differs from the saved values. */
  editing?: boolean;
  /** Return "ok" to close the panel, or an error message to keep it open. Role and team are "" when left empty. */
  onSave: (name: string, role: string, team: string) => string | Promise<string>;
  onClose: () => void;
};

/** Shared compact side panel for the Create owner, Edit owner and Add New Role or Position forms. */
export default function OwnerFormDrawer({
  heading,
  submitLabel,
  initialName = "",
  initialRole = "",
  initialTeam = "",
  requireRole = false,
  showRole = true,
  editing = false,
  onSave,
  onClose,
}: OwnerFormDrawerProps) {
  const { ownerRecords } = useBacklog();
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState(initialRole);
  const [team, setTeam] = useState(initialTeam);
  const [error, setError] = useState("");

  const unchanged = editing && name.trim() === initialName.trim() && role.trim() === initialRole.trim() && team.trim() === initialTeam.trim();

  async function submit() {
    const result = await onSave(name, role.trim(), team.trim());
    if (result !== "ok") {
      setError(result);
      return false;
    }
  }

  const clear = <T,>(set: (v: T) => void) => (v: T) => (set(v), setError(""));

  return (
    <BacklogDrawer heading={heading} submitLabel={submitLabel} onSubmit={submit} canSubmit={!unchanged} onClose={onClose} compact>
      <TextField label="Name" required value={name} onChange={clear(setName)} placeholder="e.g. Jordan Blake" />
      {showRole && (
        <ComboField
          label="Role / Position"
          required={requireRole}
          value={role}
          onChange={clear(setRole)}
          suggestions={roleSuggestions(ownerRecords)}
          placeholder="e.g. Developer – Backend"
        />
      )}
      <ComboField
        label="Team"
        value={team}
        onChange={clear(setTeam)}
        suggestions={teamSuggestions(ownerRecords)}
        placeholder="e.g. Futures & Platform"
      />
      {error && (
        <FieldError>
          {error}
        </FieldError>
      )}
    </BacklogDrawer>
  );
}
