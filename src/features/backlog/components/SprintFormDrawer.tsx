"use client";

import { useRef, useState } from "react";
import { TextField } from "@/components/ui/FormControls";
import LeaveEditor from "@/components/ui/LeaveEditor";
import { addDays } from "@/features/work/utils";
import BacklogDrawer from "./BacklogDrawer";
import { FieldError } from "@/components/ui/FieldError";

export type SprintFormValues = {
  name: string;
  start: string;
  /** Always start + 13 days: every sprint lasts two weeks. */
  end: string;
  goal: string;
  podIds: string[];
  /** Common leave dates picked in the form (only when `withLeave`). */
  leaves: { date: string; name: string }[];
};

type SprintFormDrawerProps = {
  heading: string;
  submitLabel: string;
  initial: Omit<SprintFormValues, "end" | "leaves">;
  /** Offer "Add Common Leave Dates" (a Super Admin planning a new sprint). */
  withLeave?: boolean;
  /** The common leave the sprint already has (when editing), so the list starts with it. */
  initialLeaves?: { date: string; name: string }[];
  /** Editing an existing sprint: saving is off until something differs from `initial`. */
  editing?: boolean;
  /** Return "ok" to close the panel, or an error message to keep it open. */
  onSave: (values: SprintFormValues) => string | Promise<string>;
  /** A message while the chosen dates are not allowed (checked as the start date changes; it blocks saving); "" when they are fine. */
  dateProblem?: (start: string, end: string) => string;
  onClose: () => void;
};

/** Shared layout for the New sprint and Edit sprint side panels. A sprint's existing PODs are kept as they are (not shown or changed here). */
export default function SprintFormDrawer({ heading, submitLabel, initial, editing = false, withLeave = false, initialLeaves = [], onSave, dateProblem, onClose }: SprintFormDrawerProps) {
  const [name, setName] = useState(initial.name);
  const [start, setStart] = useState(initial.start);
  const [goal, setGoal] = useState(initial.goal);
  const [error, setError] = useState("");
  const [leaves, setLeaves] = useState<{ id: string; date: string; name: string }[]>(() => initialLeaves.map((l, i) => ({ ...l, id: `i${i}` })));
  const nextId = useRef(0);

  // A sprint is always two weeks long, so the end date can't be chosen: it follows the start date.
  const end = start ? addDays(start, 13) : "";

  const problem = start && dateProblem ? dateProblem(start, end) : "";
  const leaveKey = (list: readonly { date: string; name: string }[]) => JSON.stringify(list.map((l) => [l.date, l.name, 0]));
  const unchanged = editing && name.trim() === initial.name.trim() && start === initial.start && goal.trim() === initial.goal.trim() && (!withLeave || leaveKey(leaves) === leaveKey(initialLeaves));

  async function submit() {
    if (problem) return setError(problem), false;
    const result = await onSave({ name, start, end, goal, podIds: initial.podIds, leaves: leaves.filter((l) => l.date >= start && l.date <= end).map(({ date, name }) => ({ date, name })) });
    if (result !== "ok") {
      setError(result);
      return false;
    }
  }

  return (
    <BacklogDrawer heading={heading} subtitle="Set the sprint's name, dates and goal." submitLabel={submitLabel} onSubmit={submit} canSubmit={!unchanged && !problem} onClose={onClose} compact>
      <TextField label="Name" required value={name} onChange={(v) => (setName(v), setError(""))} />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Start" type="date" required value={start} onChange={(v) => (setStart(v), setError(""))} />
        <TextField label="End (2 weeks)" type="date" disabled disabledReason="Set automatically: two weeks after the start." value={end} onChange={() => {}} />
      </div>
      <TextField label="Sprint goal" value={goal} onChange={setGoal} placeholder="What should this sprint ship?" />
      {withLeave && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Common leave <span className="font-normal">(0 working hours for everyone in this sprint)</span></span>
          <LeaveEditor
            kind="common"
            named
            canEdit={!!start}
            min={start}
            max={end}
            addLabel="Add Common Leave"
            empty={start ? "None added. Weekends are already 0 hours." : "Pick the start date first."}
            rows={leaves.filter((l) => l.date >= start && l.date <= end)}
            onAdd={(date, name) => {
              if (date < start || date > end) return "Pick a day inside the sprint.";
              if (leaves.some((l) => l.date === date)) return "That date is already added.";
              setLeaves((all) => [...all, { id: String(nextId.current++), date, name: name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
            }}
            onEdit={(id, date, name) => {
              if (date < start || date > end) return "Pick a day inside the sprint.";
              if (leaves.some((l) => l.id !== id && l.date === date)) return "That date is already added.";
              setLeaves((all) => all.map((l) => (l.id === id ? { ...l, date, name: name.trim() } : l)).sort((a, b) => a.date.localeCompare(b.date)));
            }}
            onRemove={(id) => setLeaves((all) => all.filter((l) => l.id !== id))}
          />
        </div>
      )}
      {(error || problem) && (
        <FieldError>
          {error || problem}
        </FieldError>
      )}
    </BacklogDrawer>
  );
}
