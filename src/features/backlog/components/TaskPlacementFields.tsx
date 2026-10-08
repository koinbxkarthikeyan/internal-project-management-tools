"use client";

import { SelectField } from "@/components/ui/FormControls";
import { useBacklog } from "../context/BacklogContext";

/**
 * Where a task goes, chosen from one Sprint dropdown: the running sprint, or "Unplanned Task". `choice` is the
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
  const { activeSprint } = useBacklog();

  const sprintOptions = activeSprint ? [activeSprint.name] : [];
  // A task already planned in an earlier sprint can stay there (that sprint is closed now).
  const earlier = current && current.sprint !== "Unplanned" && current.sprint !== activeSprint?.name ? current.sprint : null;
  const options = [
    ...sprintOptions.map((s) => ({ value: s, label: s })),
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
        options={[...options, { value: UNPLANNED, label: "Unplanned Task" }]}
        placeholder="Choose sprint"
      />
      {!activeSprint && (
        <p className="col-span-full order-5 -mt-2 text-xs text-muted">
          No sprint is running, so a task can only be an Unplanned Task for now. Start a sprint on Sprint plan to plan tasks into it.
        </p>
      )}
      {value.kind === "sprint" && activeSprint && value.choice === activeSprint.name && (
        <p className="col-span-full order-5 -mt-2 text-xs text-muted">This task will be part of {activeSprint.name}, the running sprint.</p>
      )}
      {value.kind === "unplanned" && (
        <p className="col-span-full order-5 -mt-2 text-xs text-muted">An Unplanned Task isn&apos;t part of the sprint plan.</p>
      )}
    </>
  );
}
