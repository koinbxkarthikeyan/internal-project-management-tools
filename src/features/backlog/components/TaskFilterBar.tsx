"use client";

import FilterBar, { FilterPill } from "@/components/ui/FilterBar";
import { PRIORITIES } from "@/constants/backlog-options";
import BacklogSearch from "./BacklogSearch";

export type TaskFilters = { search: string; status: string; priority: string; team: string; assignee: string };
export const NO_TASK_FILTERS: TaskFilters = { search: "", status: "", priority: "", team: "", assignee: "" };
export const isTaskFiltering = (f: TaskFilters) => Object.values(f).some(Boolean);

/** The task pages' filter bar (QA Workspace, My Task): the app's shared toolbar with a pill each for Status, Priority, Team and Assignee. Teams and people are given by id. */
export default function TaskFilterBar({ filters, onChange, statuses, teams, assignees, label }: { filters: TaskFilters; onChange: (f: TaskFilters) => void; statuses: readonly { value: string; label: string }[]; teams: readonly (readonly [string, string])[]; assignees: readonly (readonly [string, string])[]; label: string }) {
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });
  return (
    <FilterBar
      label={label}
      search={<BacklogSearch value={filters.search} onChange={(search) => set({ search })} placeholder="Search task ID or title…" ariaLabel="Search tasks" />}
      activeCount={Object.values(filters).filter(Boolean).length}
      onClear={() => onChange(NO_TASK_FILTERS)}
    >
      <FilterPill label="Status" value={filters.status} onChange={(status) => set({ status })} options={statuses} />
      <FilterPill label="Priority" value={filters.priority} onChange={(priority) => set({ priority })} options={PRIORITIES} />
      <FilterPill label="Team" value={filters.team} onChange={(team) => set({ team })} options={teams.map(([value, label]) => ({ value, label }))} />
      <FilterPill label="Assignee" value={filters.assignee} onChange={(assignee) => set({ assignee })} options={assignees.map(([value, label]) => ({ value, label }))} />
    </FilterBar>
  );
}
