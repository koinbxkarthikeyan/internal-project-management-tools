"use client";

import type { Sprint } from "@/types/backlog";
import { formatDay } from "../utils";

type DatedSprint = Sprint & { start: string; end: string };

type SprintPickerProps = {
  sprints: readonly DatedSprint[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
};

/** Pick one or more sprints (each lasts a week); at least one stays selected. */
export default function SprintPicker({ sprints, selectedIds, onChange }: SprintPickerProps) {
  function toggle(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id];
    if (next.length > 0) onChange(next);
  }

  return (
    <fieldset className="rounded-2xl border border-border bg-surface p-5">
      <legend className="sr-only">Sprints</legend>
      <p className="text-sm font-semibold">
        Sprints <span className="text-xs font-normal text-muted">({selectedIds.length} selected, each lasts two weeks)</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {sprints.map((s) => (
          <label key={s.id} className="cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(s.id)}
              onChange={() => toggle(s.id)}
              className="peer sr-only"
            />
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-hover peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs">
                {formatDay(s.start)} – {formatDay(s.end)}
              </span>
              {s.status === "Closed" && <span className="text-xs">· Closed</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
