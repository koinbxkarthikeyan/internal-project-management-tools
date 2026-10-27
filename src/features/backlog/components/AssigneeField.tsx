"use client";

import { useId, useRef, useState } from "react";
import { Field, controlClass } from "@/components/ui/FormControls";
import { createPortal } from "react-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import UserFormDrawer from "@/features/users/components/UserFormDrawer";
import { useUsers } from "@/features/users/hooks/useUsers";
import { refreshUsers } from "@/lib/auth/userStore";
import { useUsersStore } from "@/stores/usersStore";

type AssigneeFieldProps = {
  /** Names separated by commas. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
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

/** Assignees ready to save, e.g. "Mayil, Sasi" (no empty entries or repeats). The Lead may also be an assignee. */
export const cleanAssignees = (value: string) => assigneeNames(value).join(", ");

/**
 * Assignees field: type to search the registered users (with or without "@"), pick as many as needed.
 * Picked names stay in the field, separated by commas; picking a name again removes it.
 */
export default function AssigneeField({ value, onChange, placeholder = "Search or select team members, or add a new team member." }: AssigneeFieldProps) {
  const users = useUsers();
  const usersStatus = useUsersStore((st) => st.optionsStatus);
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Opens below the field, or above it when there is little room below.
  const show = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setUp(window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom);
    if (usersStatus !== "ready") void refreshUsers(); // a failed or unfinished read is tried again when the list is opened
    setOpen(true);
  };
  const listId = useId();
  const [open, setOpen] = useState(false);

  // Everything after the last comma is the search text; the names before it are already chosen. A last entry that is exactly a
  // user's name (an assignee loaded with the task, or one just picked) is a chosen name, not a search, so the whole list stays open.
  const parts = value.split(",");
  const lastEntry = clean(parts[parts.length - 1]).toLowerCase();
  const lastIsName = users.some((u) => u.name.toLowerCase() === lastEntry);
  const query = lastIsName ? "" : lastEntry;
  const chosen = assigneeNames(value).map((n) => n.toLowerCase());

  const seen = new Set<string>();
  const matches = users.filter((u) => {
    const key = u.name.toLowerCase();
    if (seen.has(key) || (query && !key.includes(query))) return false;
    seen.add(key);
    return true;
  });

  function toggle(name: string) {
    // Keep the names already chosen; half-typed search text is dropped.
    const kept = assigneeNames(parts.slice(0, lastIsName ? undefined : -1).join(","));
    const next = chosen.includes(name.toLowerCase())
      ? kept.filter((n) => n.toLowerCase() !== name.toLowerCase())
      : [...kept, name];
    onChange(next.length ? `${next.join(", ")}, ` : "");
  }

  return (
    <div ref={wrapRef} className="relative min-w-0" onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setOpen(false);
        if (value) onChange(cleanAssignees(value));
      }}>
      <Field label="Assignees, separated by commas">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={show}
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
        // Only the names scroll; "+ Add New Team Member" stays fixed at the bottom.
        <div className={`anim-fade-up absolute inset-x-0 z-10 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg ${up ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <ul id={listId} role="listbox" aria-label="Registered users" className="max-h-48 min-h-0 flex-1 overflow-y-auto p-1">
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">
              {users.length > 0 ? "No matching users." : usersStatus === "loading" ? "Loading users…" : usersStatus === "error" ? "Couldn't load the users. Close and reopen this list to try again." : "No registered users."}
            </li>
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
          </ul>
          {isAdmin && (
            <div className="shrink-0 border-t border-border p-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (setOpen(false), setAdding(true))}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                + Add New Team Member
              </button>
            </div>
          )}
        </div>
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
