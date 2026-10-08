"use client";

import { useToast } from "@/components/ui/Toast";
import { useBacklog } from "../context/BacklogContext";
import { todayISO } from "../utils";
import SprintFormDrawer from "./SprintFormDrawer";

type CreateSprintDrawerProps = {
  onClose: () => void;
};

export default function CreateSprintDrawer({ onClose }: CreateSprintDrawerProps) {
  const { sprintNames, addSprint } = useBacklog();
  const toast = useToast();

  // Defaults: next "Sprint N", starting today and running two weeks.
  const max = sprintNames.reduce((m, n) => Math.max(m, Number(/^Sprint (\d+)$/i.exec(n)?.[1]) || 0), 0);
  const today = todayISO();

  return (
    <SprintFormDrawer
      heading="New sprint"
      submitLabel="Create sprint"
      initial={{ name: `Sprint ${max + 1}`, start: today, goal: "", podIds: [] }}
      onClose={onClose}
      onSave={async ({ name, start, end, goal, podIds }) => {
        const trimmed = name.trim();
        const result = await addSprint({ name: trimmed, start, end, goal: goal.trim(), podIds });
        if (result === "running") return "A sprint is still running. Close it before starting the next one.";
        if (result === "duplicate") return `A sprint named "${trimmed}" already exists.`;
        if (result === "error") return "Couldn't create the sprint. Please try again.";
        toast.show(`${trimmed} created`);
        return "ok";
      }}
    />
  );
}
