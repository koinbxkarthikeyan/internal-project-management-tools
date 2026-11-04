"use client";

import { SearchableSelect } from "@/components/ui/FormControls";
import { PRIORITIES } from "@/constants/backlog-options";
import BacklogSearch from "./BacklogSearch";

export type TaskFilters = { search: string; status: string; priority: string; team: string; assignee: string };
export const NO_TASK_FILTERS: TaskFilters = { search: "", status: "", priority: "", team: "", assignee: "" };
export const isTaskFiltering = (f: TaskFilters) => Object.values(f).some(Boolean);

const grow = "min-w-0 flex-1 basis-32 sm:flex-none sm:basis-40";

/** The task pages' filter toolbar (QA Workspace, My Task): the same bar as All items and Team Members (search, then the app's own dropdowns, then Clear). Teams and people are given by id. */
export default function TaskFilterBar({ filters, onChange, statuses, teams, assignees, label }: { filters: TaskFilters; onChange: (f: TaskFilters) => void; statuses: readonly { value: string; label: string }[]; teams: readonly (readonly [string, string])[]; assignees: readonly (readonly [string, string])[]; label: string }) {
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });
  return (
    <section aria-label={label} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2.5">
      <BacklogSearch value={filters.search} onChange={(search) => set({ search })} placeholder="Search task ID or title…" ariaLabel="Search tasks" />
      <SearchableSelect ariaLabel="Filter by status" value={filters.status} onChange={(status) => set({ status })} options={[...statuses]} placeholder="Status: All" className={grow} />
      <SearchableSelect ariaLabel="Filter by priority" value={filters.priority} onChange={(priority) => set({ priority })} options={[...PRIORITIES.map((p) => ({ value: p, label: p }))]} placeholder="Priority: All" className={grow} />
      <SearchableSelect ariaLabel="Filter by team" value={filters.team} onChange={(team) => set({ team })} options={[...teams.map(([value, label]) => ({ value, label }))]} placeholder="Team: All" className={grow} />
      <SearchableSelect ariaLabel="Filter by assignee" value={filters.assignee} onChange={(assignee) => set({ assignee })} options={[...assignees.map(([value, label]) => ({ value, label }))]} placeholder="Assignee: All" className={grow} />
      {isTaskFiltering(filters) && (
        <button type="button" onClick={() => onChange(NO_TASK_FILTERS)} className="h-10 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
          Clear
        </button>
      )}
    </section>
  );
}
