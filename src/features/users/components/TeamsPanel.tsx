"use client";

import { useState } from "react";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { teamOptions } from "@/lib/auth/teams";
import { useTeamStore } from "@/stores/teamStore";
import type { AppUser } from "@/types/auth";
import { addTeam, membersIn, removeTeam, renameTeam } from "../teamActions";

const btn = "shrink-0 rounded-md px-2 py-1 text-xs font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent";
const iconBtn = "shrink-0 rounded-md p-1.5 text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Add, rename and delete Teams right on the Team Members page (a folded section, so no form has to be opened). A rename turns the row into a
 * text box; a delete asks on the same row. A team with members can't be deleted. Teams are kept in this browser only.
 */
export default function TeamsPanel({ users }: { users: readonly AppUser[] }) {
  const renames = useTeamStore((s) => s.renames);
  const deleted = useTeamStore((s) => s.deleted);
  const custom = useTeamStore((s) => s.custom);
  const teams = teamOptions(users, [], { renames, deleted, custom });

  const [fresh, setFresh] = useState("");
  const [freshError, setFreshError] = useState("");
  const [edit, setEdit] = useState<{ from: string; text: string } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  const reset = () => (setEdit(null), setAsking(null), setRowError(""));

  function add() {
    const err = addTeam(fresh, teams);
    if (err) return setFreshError(err);
    setFresh("");
    setFreshError("");
  }
  function save() {
    if (!edit) return;
    const err = renameTeam(edit.from, edit.text, teams);
    if (err) setRowError(err);
    else reset();
  }

  return (
    <details className="group rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">▸</span>
        Manage teams
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted">{teams.length}</span>
        <span className="ml-auto text-xs font-normal text-muted">Add, rename or delete a team</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-4">
        <form
          onSubmit={(e) => (e.preventDefault(), add())}
          className="flex flex-wrap items-start gap-2"
        >
          <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
            <input
              id="new-team-name"
              aria-label="New team name"
              value={fresh}
              onChange={(e) => (setFresh(e.target.value), setFreshError(""))}
              placeholder="New team name"
              autoComplete="off"
              className="field h-10 w-full text-sm"
            />
            {freshError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{freshError}</p>}
          </div>
          <button type="submit" disabled={!fresh.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <PlusIcon width={14} height={14} /> Add team
          </button>
        </form>

        {teams.length === 0 ? (
          <p className="text-sm text-muted">No teams yet. Add the first one above.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => {
              const n = membersIn(users, t);
              return (
                <li key={t} className="min-w-0 rounded-lg px-2 py-1 hover:bg-hover/50">
                  {edit?.from === t ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          aria-label={`New name for ${t}`}
                          value={edit.text}
                          onChange={(e) => (setEdit({ from: t, text: e.target.value }), setRowError(""))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") return e.preventDefault(), save();
                            if (e.key === "Escape") return e.preventDefault(), reset();
                          }}
                          className="field h-8 min-w-0 flex-1 px-2 text-sm"
                        />
                        <button type="button" onClick={save} className={`${btn} text-accent`}>Save</button>
                        <button type="button" onClick={reset} className={`${btn} text-muted`}>Cancel</button>
                      </div>
                      {rowError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{rowError}</p>}
                    </div>
                  ) : asking === t ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">Delete &ldquo;{t}&rdquo;?</span>
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            autoFocus
                            onClick={() => {
                              const err = removeTeam(users, t);
                              if (err) setRowError(err);
                              else reset();
                            }}
                            className={`${btn} text-red-600 dark:text-red-300`}
                          >
                            Delete
                          </button>
                          <button type="button" onClick={reset} className={`${btn} text-muted`}>Cancel</button>
                        </span>
                      </div>
                      {rowError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{rowError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="min-w-0 flex-1 truncate text-sm">{t}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{n} {n === 1 ? "member" : "members"}</span>
                      <button type="button" onClick={() => (reset(), setEdit({ from: t, text: t }))} aria-label={`Rename ${t}`} title="Rename" className={`${iconBtn} hover:text-accent`}>
                        <EditIcon width={14} height={14} />
                      </button>
                      <button type="button" onClick={() => (reset(), setAsking(t))} aria-label={`Delete ${t}`} title="Delete" className={`${iconBtn} hover:text-red-600 dark:hover:text-red-300`}>
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
