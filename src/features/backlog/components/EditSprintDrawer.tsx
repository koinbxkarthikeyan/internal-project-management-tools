"use client";

import { useToast } from "@/components/ui/Toast";
import type { Sprint } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import SprintFormDrawer from "./SprintFormDrawer";

type EditSprintDrawerProps = {
  sprint: Sprint;
  onClose: () => void;
};

export default function EditSprintDrawer({ sprint, onClose }: EditSprintDrawerProps) {
  const { updateSprint } = useBacklog();
  const toast = useToast();

  return (
    <SprintFormDrawer
      heading={`Edit ${sprint.name}`}
      submitLabel="Save sprint"
      initial={{ name: sprint.name, start: sprint.start ?? "", goal: sprint.goal ?? "", podIds: sprint.podIds ?? [] }}
      onClose={onClose}
      onSave={async ({ name, start, end, goal, podIds }) => {
        const result = await updateSprint(sprint.name, { name, start, end, goal: goal.trim(), podIds });
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
