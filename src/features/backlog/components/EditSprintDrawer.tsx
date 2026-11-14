"use client";

import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Sprint } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { sprintDateProblem } from "../sprintDates";
import SprintFormDrawer from "./SprintFormDrawer";

type EditSprintDrawerProps = {
  sprint: Sprint;
  onClose: () => void;
};

export default function EditSprintDrawer({ sprint, onClose }: EditSprintDrawerProps) {
  const { sprints, updateSprint } = useBacklog();
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  // A Super Admin changes the sprint's common leave here too (a closed sprint keeps its dates as history).
  const withLeave = isSuperAdmin && sprint.status !== "Closed";

  return (
    <SprintFormDrawer
      heading={`Edit ${sprint.name}`}
      submitLabel="Save sprint"
      editing
      withLeave={withLeave}
      initialLeaves={(sprint.commonLeaves ?? []).map((l) => ({ date: l.date, name: l.description }))}
      initial={{ name: sprint.name, start: sprint.start ?? "", goal: sprint.goal ?? "", podIds: sprint.podIds ?? [] }}
      // Its own dates are not a clash: only the other sprints count.
      dateProblem={(s, e) => sprintDateProblem(sprints, s, e, sprint.name)}
      onClose={onClose}
      onSave={async ({ name, start, end, goal, podIds, leaves }) => {
        const result = await updateSprint(sprint.name, { name, start, end, goal: goal.trim(), podIds, ...(withLeave ? { commonLeaves: leaves.map((l) => ({ date: l.date, description: l.name })) } : {}) });
        if (result === "empty") return "Name can't be empty.";
        if (result === "duplicate") return `A sprint named "${name.trim()}" already exists.`;
        if (result === "error") return "Couldn't save the sprint. Please try again.";
        if (result === "locked") return "This sprint can't be edited.";
        toast.show(`${name.trim()} updated`);
        return "ok";
      }}
    />
  );
}
