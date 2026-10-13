"use client";

import { SelectField } from "@/components/ui/FormControls";
import type { Sprint } from "@/types/backlog";
import { formatDay } from "../utils";

type DatedSprint = Sprint & { start: string; end: string };

type SprintPickerProps = {
  sprints: readonly DatedSprint[];
  /** The selected sprint (a single one; the page follows the running sprint until another is picked). */
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
};

/** Pick the sprint to look at from a dropdown. Every sprint is listed, finished ones too. */
export default function SprintPicker({ sprints, selectedIds, onChange }: SprintPickerProps) {
  const labelOf = (s: DatedSprint) => `${s.name} · ${formatDay(s.start)} – ${formatDay(s.end)}${s.status === "Closed" ? " · Closed" : s.status === "Active" ? " · Active" : ""}`;

  return (
    <section aria-label="Sprint" className="rounded-2xl border border-border bg-surface p-5">
      <SelectField
        label="Sprint"
        value={selectedIds[0] ?? ""}
        onChange={(id) => id && onChange([id])}
        options={sprints.map((s) => ({ value: s.id, label: labelOf(s) }))}
        placeholder="Choose sprint"
        required
        className="max-w-md"
      />
    </section>
  );
}
