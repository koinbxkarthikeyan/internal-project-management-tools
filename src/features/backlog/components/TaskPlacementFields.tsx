"use client";

import { SelectField } from "@/components/ui/FormControls";
import { useBacklog } from "../context/BacklogContext";

/**
 * Where a task goes, chosen from one Sprint dropdown: the running sprint, a planned sprint, or Backlog. `choice` is the
 * sprint's name when a sprint is picked.
 */
export type Placement = { kind: "" | "sprint" | "unplanned"; choice: string };

export const emptyPlacement: Placement = { kind: "", choice: "" };

type Placed = { sprint: string; podId?: string };

export const placementFromItem = (item: Placed): Placement =>
  item.sprint === "Unplanned" ? { kind: "unplanned", choice: "" } : { kind: "sprint", choice: item.sprint };

/** The sprint (and, for a task that already has one, its POD) to save with the task. */
export function placementToItem(p: Placement, current?: Placed): Placed {
  if (p.kind === "sprint") return { sprint: p.choice, podId: current?.sprint === p.choice ? current.podId : undefined };
  return { sprint: "Unplanned" };
}

type TaskPlacementFieldsProps = {
  value: Placement;
  onChange: (value: Placement) => void;
  /** Edit only: where the task is now, so a task in an earlier (closed) sprint keeps showing that sprint. */
  current?: Placed;
  /** Puts the Sprint field fourth in a two-column form. */
  createLayout?: boolean;
};

const UNPLANNED = "__unplanned__";

export default function TaskPlacementFields({ value, onChange, current, createLayout = false }: TaskPlacementFieldsProps) {
  const { activeSprint, sprints } = useBacklog();

  // Every sprint a task can be planned into: the running one and the planned ones (waiting to start). Closed sprints never take a task.
  const open = sprints.filter((s) => s.name !== "Unplanned" && s.status !== "Closed");
  const stateOf = (s: { status?: string }) => (s.status === "Active" ? "Active" : "Planned");
  const sprintOptions = open.map((s) => ({ name: s.name, label: `${s.name} (${stateOf(s)})` }));
  // A task already planned in an earlier sprint can stay there (that sprint is closed now).
  const earlier = current && current.sprint !== "Unplanned" && !open.some((s) => s.name === current.sprint) ? current.sprint : null;
  const options = [
    ...sprintOptions.map((s) => ({ value: s.name, label: s.label })),
    ...(earlier ? [{ value: earlier, label: `${earlier} (closed)` }] : []),
  ];

  const choose = (v: string) =>
    onChange(v === UNPLANNED ? { kind: "unplanned", choice: "" } : v ? { kind: "sprint", choice: v } : emptyPlacement);

  return (
    <>
      <SelectField
        label="Sprint"
        required
        className={createLayout ? "order-4" : undefined}
        value={value.kind === "sprint" ? value.choice : value.kind === "unplanned" ? UNPLANNED : ""}
        onChange={choose}
        options={[...options, { value: UNPLANNED, label: "Backlog" }]}
        placeholder="Choose sprint"
      />
      {open.length === 0 && (
        <p className="col-span-full order-5 -mt-2 text-xs text-muted">
          No sprint is running or planned, so this task goes to Backlog. Plan a sprint on Sprint plan to add tasks to it.
        </p>
      )}
      {value.kind === "sprint" && open.some((s) => s.name === value.choice) && (
        <p className="col-span-full order-5 -mt-2 text-xs text-muted">
          This task joins {value.choice}, {value.choice === activeSprint?.name ? "the running sprint" : "a planned sprint"}.
        </p>
      )}
      {value.kind === "unplanned" && (
        <p className="col-span-full order-5 -mt-2 text-xs text-muted">A Backlog task isn&apos;t part of any sprint yet.</p>
      )}
    </>
  );
}
