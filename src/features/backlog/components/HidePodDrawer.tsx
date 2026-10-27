"use client";

import { useToast } from "@/components/ui/Toast";
import type { Pod } from "@/types/work";
import { useBacklog } from "../context/BacklogContext";
import ConfirmDeleteDrawer from "./ConfirmDeleteDrawer";

/** Confirmation for hiding a POD. Nothing is deleted: its tasks, sprints and logged time stay as they are. */
export default function HidePodDrawer({ pod, onClose }: { pod: Pod; onClose: () => void }) {
  const { items, hidePod } = useBacklog();
  const toast = useToast();
  const tasks = items.filter((i) => i.podId === pod.id).length;

  return (
    <ConfirmDeleteDrawer
      title="Hide POD"
      name={pod.name}
      confirmLabel="Confirm hide"
      consequence={`It is hidden from sprints and task choices. Its ${tasks} ${tasks === 1 ? "task" : "tasks"} and logged time are kept.`}
      onClose={onClose}
      onConfirm={async () => {
        if (!(await hidePod(pod.id))) return false;
        toast.show(`POD ${pod.name} hidden`, "info");
      }}
    />
  );
}
