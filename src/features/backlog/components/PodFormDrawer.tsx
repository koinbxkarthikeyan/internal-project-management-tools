"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import type { Pod } from "@/types/work";
import { useBacklog } from "../context/BacklogContext";
import BacklogDrawer from "./BacklogDrawer";

type PodFormDrawerProps = {
  /** The POD being edited; omit to create one. */
  pod?: Pod;
  onClose: () => void;
};

/** Side panel to create a POD on its own or rename one. Names are unique (ignoring case). */
export default function PodFormDrawer({ pod, onClose }: PodFormDrawerProps) {
  const { pods, addPod, updatePod } = useBacklog();
  const toast = useToast();
  const [name, setName] = useState(pod?.name ?? "");
  const [error, setError] = useState("");

  const clean = name.trim().replace(/\s+/g, " ");
  const taken = pods.some((p) => p.id !== pod?.id && p.name.toLowerCase() === clean.toLowerCase());

  async function submit() {
    if (!clean) return setError("POD name can't be empty."), false;
    if (taken) return setError(`A POD named "${clean}" already exists.`), false;
    if (pod) {
      const result = await updatePod(pod.id, clean);
      if (result === "duplicate") return setError(`A POD named "${clean}" already exists.`), false;
      if (result !== "ok") return setError("Couldn't save the POD. Please try again."), false;
      toast.show(`POD renamed to ${clean}`);
      return;
    }
    const created = await addPod(clean);
    if (!created) return setError("Couldn't create the POD. Please try again."), false;
    toast.show(`POD ${created.name} created`);
  }

  return (
    <BacklogDrawer heading={pod ? "Edit POD" : "Create POD"} submitLabel={pod ? "Save POD" : "Create POD"} onSubmit={submit} onClose={onClose} compact>
      <TextField label="POD name" required value={name} onChange={(v) => (setName(v), setError(""))} placeholder="e.g. Futures & Platform" />
      {taken && !error && <p className="-mt-2 text-xs text-muted">A POD with this name already exists.</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </BacklogDrawer>
  );
}
