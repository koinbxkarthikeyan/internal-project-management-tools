"use client";

import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useBacklog } from "../context/BacklogContext";
import { todayISO } from "../utils";
import { earliestStart, sprintDateProblem } from "../sprintDates";
import SprintFormDrawer from "./SprintFormDrawer";

type CreateSprintDrawerProps = {
  onClose: () => void;
};

export default function CreateSprintDrawer({ onClose }: CreateSprintDrawerProps) {
  const { sprintNames, sprints, addSprint } = useBacklog();
  const toast = useToast();
  const { isSuperAdmin } = useAuth();

  // Defaults: next "Sprint N", starting the day after the last sprint ends (or today, if that is later) and running two weeks.
  const max = sprintNames.reduce((m, n) => Math.max(m, Number(/^Sprint (\d+)$/i.exec(n)?.[1]) || 0), 0);
  const start = earliestStart(sprints, todayISO());

  return (
    <SprintFormDrawer
      heading="Plan New Sprint"
      submitLabel="Plan sprint"
      withLeave={isSuperAdmin}
      initial={{ name: `Sprint ${max + 1}`, start, goal: "", podIds: [] }}
      dateProblem={(s, e) => sprintDateProblem(sprints, s, e)}
      onClose={onClose}
      onSave={async ({ name, start, end, goal, podIds, leaves }) => {
        const trimmed = name.trim();
        const result = await addSprint({ name: trimmed, start, end, goal: goal.trim(), podIds, ...(leaves.length ? { commonLeaves: leaves.map((l) => ({ date: l.date, description: l.name })) } : {}) });
        if (result === "running") return "Only one sprint can run at a time. Close the running sprint first.";
        if (result === "duplicate") return `A sprint named "${trimmed}" already exists.`;
        if (result === "error") return "Couldn't create the sprint. Please try again.";
        toast.show(`${trimmed} created`);
        return "ok";
      }}
    />
  );
}
