"use client";

import { SelectField } from "@/components/ui/FormControls";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useWorkPickStore } from "@/stores/workPickStore";
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
  const { isAdmin, isSuperAdmin } = useAuth();
  const { showAllClosed, setShowAllClosed } = useWorkPickStore();
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
      {/* An Admin can list every closed sprint; a Super Admin always sees them all, and anyone else only the latest one. */}
      {isAdmin && !isSuperAdmin && (
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showAllClosed} onChange={(e) => setShowAllClosed(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          View all closed sprints
        </label>
      )}
    </section>
  );
}
