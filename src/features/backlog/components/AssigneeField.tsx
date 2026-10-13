"use client";

import { useId, useState } from "react";
import { Field, controlClass } from "@/components/ui/FormControls";
import { createPortal } from "react-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import UserFormDrawer from "@/features/users/components/UserFormDrawer";
import { useUsers } from "@/features/users/hooks/useUsers";
import { refreshUsers } from "@/lib/auth/userStore";

type AssigneeFieldProps = {
  /** Names separated by commas. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** A name that can't be chosen here (the task's Lead can't also be an assignee). */
  exclude?: string;
};

const clean = (token: string) => token.trim().replace(/^@+/, "").trim();

/** The names in an assignees string: no empty entries, no "@", no duplicates (ignoring case). */
export function assigneeNames(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map(clean)
    .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
}

/** Assignees ready to save, e.g. "Mayil, Sasi". A name given in `exclude` (the Lead) is left out. */
export const cleanAssignees = (value: string, exclude?: string) =>
  assigneeNames(value)
    .filter((n) => !exclude || n.toLowerCase() !== exclude.toLowerCase())
    .join(", ");

/**
 * Assignees field: type to search the registered users (with or without "@"), pick as many as needed.
 * Picked names stay in the field, separated by commas; picking a name again removes it.
 */
export default function AssigneeField({ value, onChange, placeholder, exclude }: AssigneeFieldProps) {
  const users = useUsers();
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const listId = useId();
  const [open, setOpen] = useState(false);

  // Everything after the last comma is the search text; the names before it are already chosen.
  const parts = value.split(",");
  const query = clean(parts[parts.length - 1]).toLowerCase();
  const chosen = assigneeNames(value).map((n) => n.toLowerCase());

  const seen = new Set<string>();
  const matches = users.filter((u) => {
    const key = u.name.toLowerCase();
    if (seen.has(key) || key === exclude?.toLowerCase() || (query && !key.includes(query))) return false;
    seen.add(key);
    return true;
  });

  function toggle(name: string) {
    // Keep the names already chosen; half-typed search text is dropped.
    const full = users.some((u) => u.name.toLowerCase() === query);
    const kept = assigneeNames(parts.slice(0, full ? undefined : -1).join(","));
    const next = chosen.includes(name.toLowerCase())
      ? kept.filter((n) => n.toLowerCase() !== name.toLowerCase())
      : [...kept, name];
    onChange(next.length ? `${next.join(", ")}, ` : "");
  }

  return (
    <div className="relative min-w-0" onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setOpen(false);
        if (value) onChange(cleanAssignees(value, exclude));
      }}>
      <Field label="Assignees, separated by commas">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && open && (e.stopPropagation(), setOpen(false))}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          className={`${controlClass} h-10`}
        />
      </Field>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Registered users"
          className="anim-fade-up absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{users.length === 0 ? "No registered users." : "No matching users."}</li>
          )}
          {matches.map((u) => {
            const on = chosen.includes(u.name.toLowerCase());
            return (
              <li key={u.id} role="option" aria-selected={on}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(u.name)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent ${
                    on ? "font-medium text-accent" : ""
                  }`}
                >
                  <span className="min-w-0 truncate">{u.name}</span>
                  <span className="shrink-0 text-xs text-muted">{on ? "✓" : u.email}</span>
                </button>
              </li>
            );
          })}
          {isAdmin && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (setOpen(false), setAdding(true))}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                + Add Team Member
              </button>
            </li>
          )}
        </ul>
      )}
      {adding &&
        createPortal(
          <UserFormDrawer
            ownerMode
            onClose={() => setAdding(false)}
            onSaved={() => refreshUsers(true)}
            onCreated={(u) => toggle(u.name)}
          />,
          document.body,
        )}
    </div>
  );
}
