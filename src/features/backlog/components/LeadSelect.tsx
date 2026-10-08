"use client";

import { SelectField } from "@/components/ui/FormControls";
import { useUsers } from "@/features/users/hooks/useUsers";

type LeadSelectProps = {
  /** The chosen user's name, or "" for no lead. */
  value: string;
  onChange: (name: string) => void;
  className?: string;
};

/** Pick one registered user as the Lead of a task. */
export default function LeadSelect({ value, onChange, className }: LeadSelectProps) {
  const users = useUsers();
  const names = [...new Set(users.map((u) => u.name))];
  // A lead who is no longer registered stays selectable so editing doesn't silently drop them.
  const options = value && !names.includes(value) ? [value, ...names] : names;

  return <SelectField label="Lead" className={className} value={value} onChange={onChange} options={options} placeholder="Choose lead" />;
}
