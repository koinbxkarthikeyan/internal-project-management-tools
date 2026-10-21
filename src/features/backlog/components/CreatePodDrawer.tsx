"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import type { Sprint } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import BacklogDrawer from "./BacklogDrawer";
import { FieldError } from "@/components/ui/FieldError";

type CreatePodDrawerProps = {
  /** The sprint whose header the button was in: the new POD is added to it. */
  sprint: Sprint;
  onClose: () => void;
};

/** Side panel to create a POD. This is separate from creating a sprint; the POD is then added to the sprint. */
export default function CreatePodDrawer({ sprint, onClose }: CreatePodDrawerProps) {
  const { pods, addPod, addPodToSprint } = useBacklog();
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const pod = await addPod(name);
    if (!pod) return setError("Couldn't create the POD. Please try again."), false;
    // A POD that already exists can be added to this sprint too, but not twice.
    if ((sprint.podIds ?? []).includes(pod.id)) return setError(`${pod.name} is already in ${sprint.name}.`), false;
    if (!(await addPodToSprint(sprint.name, pod.id))) return false;
    toast.show(`${pod.name} added to ${sprint.name}`);
  }

  const existing = pods.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());

  return (
    <BacklogDrawer heading="Create POD" submitLabel="Create POD" onSubmit={submit} onClose={onClose} compact>
      <TextField label="POD name" required value={name} onChange={(v) => (setName(v), setError(""))} placeholder="e.g. Futures & Platform" />
      <p className="-mt-2 text-xs text-muted">
        {existing
          ? `${existing.name} already exists. It will be added to ${sprint.name}.`
          : `It will be added to ${sprint.name}. A sprint can have many PODs, and tasks are created inside a POD.`}
      </p>
      {error && (
        <FieldError>
          {error}
        </FieldError>
      )}
    </BacklogDrawer>
  );
}
