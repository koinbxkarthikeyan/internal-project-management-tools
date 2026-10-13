"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { SelectField } from "@/components/ui/FormControls";
import { useAuth } from "@/features/auth/hooks/useAuth";
import UserFormDrawer from "@/features/users/components/UserFormDrawer";
import { useUsers } from "@/features/users/hooks/useUsers";
import { refreshUsers } from "@/lib/auth/userStore";

type LeadSelectProps = {
  /** The chosen user's name, or "" for no lead. */
  value: string;
  onChange: (name: string) => void;
  className?: string;
};

/** Pick one registered user (a team member) as the Lead of a task; Admins can add a new team member from the list. */
export default function LeadSelect({ value, onChange, className }: LeadSelectProps) {
  const users = useUsers();
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const names = [...new Set(users.map((u) => u.name))];
  // A lead who is no longer registered stays selectable so editing doesn't silently drop them.
  const options = value && !names.includes(value) ? [value, ...names] : names;

  return (
    <>
      <SelectField
        label="Lead"
        className={className}
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Choose lead"
        action={isAdmin ? { label: "+ Add Team Member", onSelect: () => setAdding(true) } : undefined}
      />
      {/* In document.body: a <form> can't sit inside the backlog form's <form>. */}
      {adding &&
        createPortal(
          <UserFormDrawer
            ownerMode
            onClose={() => setAdding(false)}
            onSaved={() => refreshUsers(true)}
            onCreated={(u) => onChange(u.name)}
          />,
          document.body,
        )}
    </>
  );
}
