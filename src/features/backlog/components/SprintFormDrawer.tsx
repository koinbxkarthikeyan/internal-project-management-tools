"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/FormControls";
import { addDays } from "@/features/work/utils";
import BacklogDrawer from "./BacklogDrawer";

export type SprintFormValues = {
  name: string;
  start: string;
  /** Always start + 13 days: every sprint lasts two weeks. */
  end: string;
  goal: string;
  podIds: string[];
};

type SprintFormDrawerProps = {
  heading: string;
  submitLabel: string;
  initial: Omit<SprintFormValues, "end">;
  /** Return "ok" to close the panel, or an error message to keep it open. */
  onSave: (values: SprintFormValues) => string | Promise<string>;
  onClose: () => void;
};

/** Shared layout for the New sprint and Edit sprint side panels. A sprint's existing PODs are kept as they are (not shown or changed here). */
export default function SprintFormDrawer({ heading, submitLabel, initial, onSave, onClose }: SprintFormDrawerProps) {
  const [name, setName] = useState(initial.name);
  const [start, setStart] = useState(initial.start);
  const [goal, setGoal] = useState(initial.goal);
  const [error, setError] = useState("");

  // A sprint is always two weeks long, so the end date can't be chosen: it follows the start date.
  const end = start ? addDays(start, 13) : "";

  async function submit() {
    const result = await onSave({ name, start, end, goal, podIds: initial.podIds });
    if (result !== "ok") {
      setError(result);
      return false;
    }
  }

  return (
    <BacklogDrawer heading={heading} submitLabel={submitLabel} onSubmit={submit} onClose={onClose} compact>
      <TextField label="Name" required value={name} onChange={(v) => (setName(v), setError(""))} />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Start" type="date" required value={start} onChange={(v) => (setStart(v), setError(""))} />
        <TextField label="End (2 weeks)" type="date" disabled value={end} onChange={() => {}} />
      </div>
      <TextField label="Sprint goal" value={goal} onChange={setGoal} placeholder="What should this sprint ship?" />
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </BacklogDrawer>
  );
}
